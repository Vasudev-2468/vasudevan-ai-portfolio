"""Admin content CRUD for portfolio entities.

Direct edit endpoints for Profile / Experience / Education / Skill / Project /
Publication / Certification. Every mutation is:

  1. Admin-guarded — cookie-based session via `current_user`.
  2. Audit-logged with a before/after diff.
  3. Followed by a background per-entity vector reindex so the AI assistant
     immediately reflects the change.

Kept separate from `admin.py` so the upload → agent → diff-review flow and
the direct-edit flow don't tangle. Both live under the `/admin` prefix.
"""

from __future__ import annotations

import time
from datetime import datetime
from pathlib import Path
from typing import Annotated, Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.config import get_settings
from app.database import SessionLocal, get_session
from app.services.audit import audit
from app.services.auth import current_user
from app.services.ingest import reindex_entity, unindex_entity


# Cap uploads at 5 MiB. Bigger portraits should be resized client-side
# before upload — we're not shipping an image pipeline in the backend.
MAX_PHOTO_BYTES = 5 * 1024 * 1024
ALLOWED_PHOTO_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
PHOTO_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


router = APIRouter(
    prefix="/admin/content",
    tags=["admin-content"],
    dependencies=[Depends(current_user)],
)


# ── Background reindex (per-entity, incremental) ─────────────────────────
#
# Runs in the background after each mutation. Only the touched entity's
# vector points are recomputed, so the assistant never sees an empty
# collection window (unlike a full rebuild).


async def _reindex_entity_bg(kind: str, entity_id: int) -> None:
    async with SessionLocal() as s:
        await reindex_entity(kind, entity_id, s)


def _schedule_reindex(
    background_tasks: BackgroundTasks, kind: str, entity_id: int
) -> None:
    background_tasks.add_task(_reindex_entity_bg, kind, entity_id)


def _schedule_unindex(
    background_tasks: BackgroundTasks, kind: str, entity_id: int
) -> None:
    background_tasks.add_task(unindex_entity, kind, entity_id)


# ── Pydantic input schemas ───────────────────────────────────────────────


class ProfileIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=255)
    tagline: str = ""
    summary: str = ""
    email: str = Field(default="", max_length=120)
    phone: str = Field(default="", max_length=40)
    location: str = Field(default="", max_length=120)
    links: dict = Field(default_factory=dict)
    # Optional — the photo endpoints are the primary way to set this, but
    # allowing it here lets an admin clear or replace via a plain JSON edit.
    photo_url: str | None = Field(default=None, max_length=500)


class ExperienceIn(BaseModel):
    role: str = Field(min_length=1, max_length=160)
    company: str = Field(min_length=1, max_length=160)
    location: str = Field(default="", max_length=120)
    start_date: str = Field(default="", max_length=40)
    end_date: str = Field(default="", max_length=40)
    description: str = ""
    order_index: int = 0


class EducationIn(BaseModel):
    degree: str = Field(min_length=1, max_length=160)
    institution: str = Field(min_length=1, max_length=200)
    location: str = Field(default="", max_length=120)
    year: str = Field(default="", max_length=40)
    order_index: int = 0


class SkillIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(default="general", max_length=60)
    proficiency: int = Field(default=80, ge=0, le=100)


class ProjectIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    role: str = Field(default="", max_length=120)
    year: str = Field(default="", max_length=20)
    summary: str = ""
    achievements: list[str] = Field(default_factory=list)
    tech_stack: list[str] = Field(default_factory=list)
    repo_url: str | None = Field(default=None, max_length=255)
    demo_url: str | None = Field(default=None, max_length=255)


class PublicationIn(BaseModel):
    title: str = Field(min_length=1)
    authors: str = ""
    venue: str = ""
    year: int = Field(default=0, ge=0, le=3000)
    kind: str = Field(default="journal", pattern="^(journal|conference|patent)$")
    doi: str | None = Field(default=None, max_length=255)
    url: str | None = Field(default=None, max_length=255)


class CertificationIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    issuer: str = Field(default="", max_length=200)
    year: str | None = Field(default=None, max_length=20)


# ── Serializers ──────────────────────────────────────────────────────────


def _profile_dict(p: models.Profile) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "title": p.title,
        "tagline": p.tagline,
        "summary": p.summary,
        "email": p.email,
        "phone": p.phone,
        "location": p.location,
        "links": p.links or {},
        "photo_url": p.photo_url,
    }


def _meta(row) -> dict:
    """Common admin-metadata fields on every mutable entity."""
    return {
        "version": getattr(row, "version", 0),
        "is_public": getattr(row, "is_public", True),
        "deleted_at": getattr(row, "deleted_at", None),
    }


def _experience_dict(e: models.Experience) -> dict:
    return {
        "id": e.id,
        "role": e.role,
        "company": e.company,
        "location": e.location,
        "start_date": e.start_date,
        "end_date": e.end_date,
        "description": e.description,
        "order_index": e.order_index,
        **_meta(e),
    }


def _education_dict(e: models.Education) -> dict:
    return {
        "id": e.id,
        "degree": e.degree,
        "institution": e.institution,
        "location": e.location,
        "year": e.year,
        "order_index": e.order_index,
        **_meta(e),
    }


def _skill_dict(s: models.Skill) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "category": s.category,
        "proficiency": s.proficiency,
        **_meta(s),
    }


def _project_dict(p: models.Project) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "role": p.role,
        "year": p.year,
        "summary": p.summary,
        "achievements": p.achievements or [],
        "tech_stack": p.tech_stack or [],
        "repo_url": p.repo_url,
        "demo_url": p.demo_url,
        **_meta(p),
    }


def _publication_dict(p: models.Publication) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "authors": p.authors,
        "venue": p.venue,
        "year": p.year,
        "kind": p.kind,
        "doi": p.doi,
        "url": p.url,
        **_meta(p),
    }


def _certification_dict(c: models.Certification) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "issuer": c.issuer,
        "year": c.year,
        **_meta(c),
    }


# ── Generic CRUD helpers ─────────────────────────────────────────────────


async def _get_or_404(session: AsyncSession, Model, obj_id: int):
    row = (
        await session.execute(select(Model).where(Model.id == obj_id))
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return row


async def _list(
    session: AsyncSession,
    Model,
    serializer,
    order_by=None,
    *,
    include_deleted: bool = False,
    only_deleted: bool = False,
):
    stmt = select(Model)
    # Soft-delete filter: default view hides trashed rows; ?trash=1 shows only trashed.
    if hasattr(Model, "deleted_at"):
        if only_deleted:
            stmt = stmt.where(Model.deleted_at.is_not(None))
        elif not include_deleted:
            stmt = stmt.where(Model.deleted_at.is_(None))
    if order_by is not None:
        stmt = stmt.order_by(order_by)
    rows = (await session.execute(stmt)).scalars().all()
    return [serializer(r) for r in rows]


async def _create(
    session: AsyncSession,
    request: Request,
    background_tasks: BackgroundTasks,
    Model,
    payload: BaseModel,
    serializer,
    table_name: str,
):
    row = Model(**payload.model_dump())
    session.add(row)
    await session.flush()
    audit(
        session,
        f"{table_name}.create",
        target_table=table_name,
        target_id=row.id,
        details={"after": payload.model_dump()},
        request=request,
    )
    await session.commit()
    _schedule_reindex(background_tasks, table_name, row.id)
    return serializer(row)


async def _update(
    session: AsyncSession,
    request: Request,
    background_tasks: BackgroundTasks,
    Model,
    obj_id: int,
    payload: BaseModel,
    serializer,
    table_name: str,
    *,
    expected_version: int | None = None,
):
    row = await _get_or_404(session, Model, obj_id)

    # Optimistic locking: if the caller sends `expected_version` and it
    # doesn't match the row's current version, reject the write so the two
    # tabs can't silently overwrite each other. Callers that skip the
    # header (e.g. legacy code) still work — locking is opt-in per request.
    if (
        expected_version is not None
        and hasattr(row, "version")
        and expected_version != row.version
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                f"version conflict: expected {expected_version}, "
                f"current {row.version}. Reload to see the latest changes."
            ),
        )

    before = serializer(row)
    # exclude_unset: only copy fields the client actually sent. Otherwise
    # a form that doesn't include `photo_url` would default it to None on
    # every save and silently wipe the uploaded photo. Also drop `version`
    # so a client can't set it directly.
    patch = payload.model_dump(exclude_unset=True)
    patch.pop("version", None)
    for k, v in patch.items():
        setattr(row, k, v)
    if hasattr(row, "version"):
        row.version = (row.version or 0) + 1
    audit(
        session,
        f"{table_name}.update",
        target_table=table_name,
        target_id=row.id,
        details={"before": before, "after": patch},
        request=request,
    )
    await session.commit()
    _schedule_reindex(background_tasks, table_name, row.id)
    return serializer(row)


async def _delete(
    session: AsyncSession,
    request: Request,
    background_tasks: BackgroundTasks,
    Model,
    obj_id: int,
    serializer,
    table_name: str,
    *,
    hard: bool = False,
):
    """Soft-delete by default: stamp `deleted_at` so the row can be restored.
    Pass `hard=True` (or hit the `/purge` endpoint) to remove permanently."""
    row = await _get_or_404(session, Model, obj_id)
    snapshot = serializer(row)
    if hard or not hasattr(row, "deleted_at"):
        await session.delete(row)
        action = f"{table_name}.delete"
    else:
        row.deleted_at = datetime.utcnow()
        action = f"{table_name}.trash"
    audit(
        session,
        action,
        target_table=table_name,
        target_id=obj_id,
        details={"before": snapshot, "hard": hard},
        request=request,
    )
    await session.commit()
    # Either way, the row shouldn't be searchable via the assistant.
    _schedule_unindex(background_tasks, table_name, obj_id)
    return {"ok": True, "id": obj_id, "hard": hard}


async def _restore(
    session: AsyncSession,
    request: Request,
    background_tasks: BackgroundTasks,
    Model,
    obj_id: int,
    serializer,
    table_name: str,
):
    row = await _get_or_404(session, Model, obj_id)
    if not hasattr(row, "deleted_at") or row.deleted_at is None:
        raise HTTPException(status_code=409, detail="entity is not trashed")
    row.deleted_at = None
    if hasattr(row, "version"):
        row.version = (row.version or 0) + 1
    audit(
        session,
        f"{table_name}.restore",
        target_table=table_name,
        target_id=obj_id,
        request=request,
    )
    await session.commit()
    _schedule_reindex(background_tasks, table_name, obj_id)
    return serializer(row)


async def _set_publish(
    session: AsyncSession,
    request: Request,
    background_tasks: BackgroundTasks,
    Model,
    obj_id: int,
    is_public: bool,
    serializer,
    table_name: str,
):
    row = await _get_or_404(session, Model, obj_id)
    if not hasattr(row, "is_public"):
        raise HTTPException(status_code=400, detail="entity has no publish flag")
    if row.is_public == is_public:
        return serializer(row)
    row.is_public = is_public
    if hasattr(row, "version"):
        row.version = (row.version or 0) + 1
    audit(
        session,
        f"{table_name}.{'publish' if is_public else 'unpublish'}",
        target_table=table_name,
        target_id=obj_id,
        request=request,
    )
    await session.commit()
    # Unpublished rows shouldn't be searchable — treat as unindex.
    if is_public:
        _schedule_reindex(background_tasks, table_name, obj_id)
    else:
        _schedule_unindex(background_tasks, table_name, obj_id)
    return serializer(row)


# ── Profile (singleton) ──────────────────────────────────────────────────


@router.get("/profile")
async def get_profile(session: AsyncSession = Depends(get_session)):
    row = (
        await session.execute(select(models.Profile).limit(1))
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="profile row not seeded")
    return _profile_dict(row)


@router.put("/profile")
async def update_profile(
    payload: ProfileIn,
    request: Request,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
):
    row = (
        await session.execute(select(models.Profile).limit(1))
    ).scalar_one_or_none()
    # exclude_unset so a form omitting `photo_url` doesn't null out the row.
    patch = payload.model_dump(exclude_unset=True)
    if not row:
        row = models.Profile(**payload.model_dump())  # first-run: seed defaults
        session.add(row)
        await session.flush()
        action = "profile.create"
        before = None
    else:
        action = "profile.update"
        before = _profile_dict(row)
        for k, v in patch.items():
            setattr(row, k, v)
    audit(
        session,
        action,
        target_table="profile",
        target_id=row.id,
        details={"before": before, "after": patch},
        request=request,
    )
    await session.commit()
    _schedule_reindex(background_tasks, "profile", row.id)
    return _profile_dict(row)


# ── Profile photo (upload / delete) ──────────────────────────────────────


def _profile_photo_dir() -> Path:
    d = Path(get_settings().upload_dir) / "profile"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _remove_old_photo(url: str | None) -> None:
    """Best-effort cleanup of the previous file. Missing/mismatched paths
    are ignored — the admin can still overwrite the DB entry."""
    if not url or not url.startswith("/media/profile/"):
        return
    name = url.rsplit("/", 1)[-1]
    if "/" in name or "\\" in name or name.startswith(".."):
        return
    try:
        (_profile_photo_dir() / name).unlink(missing_ok=True)
    except OSError:
        pass


@router.post("/profile/photo")
async def upload_profile_photo(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    mime = (file.content_type or "").lower()
    if mime not in ALLOWED_PHOTO_MIME:
        raise HTTPException(
            status_code=400,
            detail=f"unsupported image type '{mime}'. Use jpeg, png, webp, or gif.",
        )
    data = await file.read()
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"image too large ({len(data)} bytes); max {MAX_PHOTO_BYTES}",
        )
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="empty file")

    row = (
        await session.execute(select(models.Profile).limit(1))
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="profile row not seeded")

    ext = PHOTO_EXT[mime]
    filename = f"{int(time.time())}-{row.id}{ext}"
    dest = _profile_photo_dir() / filename
    dest.write_bytes(data)

    previous = row.photo_url
    row.photo_url = f"/media/profile/{filename}"
    _remove_old_photo(previous)

    audit(
        session,
        "profile.photo_upload",
        target_table="profile",
        target_id=row.id,
        details={
            "before": previous,
            "after": row.photo_url,
            "size_bytes": len(data),
            "mime": mime,
        },
        request=request,
    )
    await session.commit()
    _schedule_reindex(background_tasks, "profile", row.id)
    return _profile_dict(row)


@router.delete("/profile/photo")
async def delete_profile_photo(
    request: Request,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
):
    row = (
        await session.execute(select(models.Profile).limit(1))
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="profile row not seeded")

    previous = row.photo_url
    if previous is None:
        return _profile_dict(row)

    row.photo_url = None
    _remove_old_photo(previous)
    audit(
        session,
        "profile.photo_delete",
        target_table="profile",
        target_id=row.id,
        details={"before": previous},
        request=request,
    )
    await session.commit()
    _schedule_reindex(background_tasks, "profile", row.id)
    return _profile_dict(row)


# ── DOI resolver (Crossref proxy) ──────────────────────────────────────
#
# Front-end pastes a DOI into the Papers form and we fetch metadata from
# Crossref (no auth needed; polite mailto helps the queue). The response
# is normalized to match PublicationIn so the client can spread-fill the
# form fields without a second parse.


@router.get("/publications/resolve-doi")
async def resolve_doi(doi: str = ""):
    doi = (doi or "").strip()
    # Crossref accepts either raw DOI or a URL — normalize URLs down to
    # the DOI itself for cleaner storage + a shorter API request.
    for prefix in ("https://doi.org/", "http://doi.org/", "doi.org/", "doi:"):
        if doi.lower().startswith(prefix):
            doi = doi[len(prefix):]
    if not doi:
        raise HTTPException(status_code=400, detail="doi is required")

    import httpx  # local import: httpx already in deps for other callers
    url = f"https://api.crossref.org/works/{doi}"
    headers = {"User-Agent": "vasudevan.ai admin (mailto:admin@vasudevan.ai)"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url, headers=headers)
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"crossref request failed: {ex}") from ex
    if r.status_code == 404:
        raise HTTPException(status_code=404, detail="DOI not found on Crossref")
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"crossref returned {r.status_code}")

    msg = r.json().get("message", {})
    title_list = msg.get("title") or []
    title = title_list[0] if title_list else ""
    authors_l = msg.get("author") or []
    authors = "; ".join(
        f"{(a.get('given') or '').strip()} {(a.get('family') or '').strip()}".strip()
        for a in authors_l
    )
    venue = (
        (msg.get("container-title") or [None])[0]
        or msg.get("publisher")
        or ""
    )
    # Publication year lives in one of a few date fields. Prefer print, fall
    # back to issued, then online.
    year = 0
    for key in ("published-print", "issued", "published-online"):
        parts = ((msg.get(key) or {}).get("date-parts") or [[None]])[0]
        if parts and parts[0]:
            year = int(parts[0])
            break
    type_map = {
        "journal-article": "journal",
        "proceedings-article": "conference",
        "book-chapter": "journal",
        "monograph": "journal",
        "posted-content": "journal",
        "patent": "patent",
    }
    kind = type_map.get(msg.get("type", ""), "journal")

    return {
        "title": title.strip(),
        "authors": authors.strip(),
        "venue": (venue or "").strip(),
        "year": year,
        "kind": kind,
        "doi": doi,
        "url": msg.get("URL") or f"https://doi.org/{doi}",
    }


# ── Publish-toggle body ─────────────────────────────────────────────────


class PublishIn(BaseModel):
    is_public: bool


# ── Resource registration ───────────────────────────────────────────────
#
# One entry per (kind, model, schema, serializer, order_by). The loop
# below attaches all six endpoints for each entity:
#
#   GET    /{plural}                      list (?trash=1 shows only trashed)
#   POST   /{plural}                      create
#   PUT    /{plural}/{id}                 update (accepts If-Match version)
#   DELETE /{plural}/{id}                 soft-delete (?hard=1 for permanent)
#   POST   /{plural}/{id}/restore         un-trash
#   POST   /{plural}/{id}/publish         toggle is_public via body {is_public}
#
# Adding a new entity is now a one-liner in `_RESOURCES` below.


_RESOURCES = [
    ("experience", models.Experience, ExperienceIn, _experience_dict, models.Experience.order_index),
    ("education", models.Education, EducationIn, _education_dict, models.Education.order_index),
    ("skills", models.Skill, SkillIn, _skill_dict, models.Skill.category),
    ("projects", models.Project, ProjectIn, _project_dict, models.Project.year.desc()),
    ("publications", models.Publication, PublicationIn, _publication_dict, models.Publication.year.desc()),
    ("certifications", models.Certification, CertificationIn, _certification_dict, models.Certification.id),
]

# The audit `table_name` differs from the URL plural (`experience` vs
# `experiences`), so map URL plural → singular audit name.
_TABLE_OF_PLURAL = {
    "experience": "experience",
    "education": "education",
    "skills": "skill",
    "projects": "project",
    "publications": "publication",
    "certifications": "certification",
}


def _register_resource(plural: str, Model, Schema, serializer, order_by) -> None:
    """Attach six admin endpoints for one entity type.

    Pydantic can't resolve `Schema` as a forward-ref annotation because we
    use `from __future__ import annotations` and Schema is a local
    (closure) name, not a module global. We work around it by rewriting
    the concrete class into `__annotations__` after each function is
    defined — FastAPI then sees a real class, skipping string resolution.
    """
    table_name = _TABLE_OF_PLURAL[plural]
    prefix = f"/{plural}"

    async def list_items(
        trash: Annotated[bool, Query()] = False,
        session: AsyncSession = Depends(get_session),
    ):
        return await _list(
            session, Model, serializer, order_by, only_deleted=trash
        )

    async def create_item(
        payload,  # annotation set explicitly below
        request: Request,
        background_tasks: BackgroundTasks,
        session: AsyncSession = Depends(get_session),
    ):
        return await _create(
            session, request, background_tasks,
            Model, payload, serializer, table_name,
        )
    create_item.__annotations__["payload"] = Schema

    async def update_item(
        obj_id: int,
        payload,
        request: Request,
        background_tasks: BackgroundTasks,
        if_match: Annotated[str | None, Header(alias="If-Match")] = None,
        session: AsyncSession = Depends(get_session),
    ):
        expected: int | None = None
        if if_match:
            try:
                expected = int(if_match.strip('"'))
            except ValueError:
                raise HTTPException(status_code=400, detail="If-Match must be an integer version")
        return await _update(
            session, request, background_tasks,
            Model, obj_id, payload, serializer, table_name,
            expected_version=expected,
        )
    update_item.__annotations__["payload"] = Schema

    async def delete_item(
        obj_id: int,
        request: Request,
        background_tasks: BackgroundTasks,
        hard: Annotated[bool, Query()] = False,
        session: AsyncSession = Depends(get_session),
    ):
        return await _delete(
            session, request, background_tasks,
            Model, obj_id, serializer, table_name,
            hard=hard,
        )

    async def restore_item(
        obj_id: int,
        request: Request,
        background_tasks: BackgroundTasks,
        session: AsyncSession = Depends(get_session),
    ):
        return await _restore(
            session, request, background_tasks,
            Model, obj_id, serializer, table_name,
        )

    async def publish_item(
        obj_id: int,
        payload: PublishIn,
        request: Request,
        background_tasks: BackgroundTasks,
        session: AsyncSession = Depends(get_session),
    ):
        return await _set_publish(
            session, request, background_tasks,
            Model, obj_id, payload.is_public, serializer, table_name,
        )

    router.add_api_route(prefix, list_items, methods=["GET"], name=f"list_{plural}")
    router.add_api_route(prefix, create_item, methods=["POST"], name=f"create_{plural}")
    router.add_api_route(prefix + "/{obj_id}", update_item, methods=["PUT"], name=f"update_{plural}")
    router.add_api_route(prefix + "/{obj_id}", delete_item, methods=["DELETE"], name=f"delete_{plural}")
    router.add_api_route(prefix + "/{obj_id}/restore", restore_item, methods=["POST"], name=f"restore_{plural}")
    router.add_api_route(prefix + "/{obj_id}/publish", publish_item, methods=["POST"], name=f"publish_{plural}")


for _plural, _model, _schema, _ser, _order in _RESOURCES:
    _register_resource(_plural, _model, _schema, _ser, _order)
