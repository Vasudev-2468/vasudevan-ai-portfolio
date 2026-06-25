from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Profile(Base):
    __tablename__ = "profile"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(String(255))
    tagline: Mapped[str] = mapped_column(Text)
    summary: Mapped[str] = mapped_column(Text)
    email: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(40))
    location: Mapped[str] = mapped_column(String(120))
    links: Mapped[dict] = mapped_column(JSON, default=dict)


class Experience(Base):
    __tablename__ = "experience"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role: Mapped[str] = mapped_column(String(160))
    company: Mapped[str] = mapped_column(String(160))
    location: Mapped[str] = mapped_column(String(120))
    start_date: Mapped[str] = mapped_column(String(40))
    end_date: Mapped[str] = mapped_column(String(40))
    description: Mapped[str] = mapped_column(Text)
    order_index: Mapped[int] = mapped_column(Integer, default=0)


class Education(Base):
    __tablename__ = "education"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    degree: Mapped[str] = mapped_column(String(160))
    institution: Mapped[str] = mapped_column(String(200))
    location: Mapped[str] = mapped_column(String(120))
    year: Mapped[str] = mapped_column(String(40))
    order_index: Mapped[int] = mapped_column(Integer, default=0)


class Skill(Base):
    __tablename__ = "skill"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(60))
    proficiency: Mapped[int] = mapped_column(Integer, default=80)


class Project(Base):
    __tablename__ = "project"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(120))
    year: Mapped[str] = mapped_column(String(20))
    summary: Mapped[str] = mapped_column(Text)
    achievements: Mapped[list] = mapped_column(JSON, default=list)
    tech_stack: Mapped[list] = mapped_column(JSON, default=list)
    repo_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    demo_url: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Publication(Base):
    __tablename__ = "publication"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    authors: Mapped[str] = mapped_column(Text)
    venue: Mapped[str] = mapped_column(Text)
    year: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(40))  # journal | conference | patent
    doi: Mapped[str | None] = mapped_column(String(255), nullable=True)
    url: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Certification(Base):
    __tablename__ = "certification"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    issuer: Mapped[str] = mapped_column(String(200))
    year: Mapped[str | None] = mapped_column(String(20), nullable=True)


class AssistantMessage(Base):
    __tablename__ = "assistant_message"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(String(64))
    role: Mapped[str] = mapped_column(String(20))  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Upload(Base):
    __tablename__ = "upload"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    mime: Mapped[str] = mapped_column(String(120))
    path: Mapped[str] = mapped_column(String(500))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(40), default="received")  # received|processing|done|error
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AgentTask(Base):
    __tablename__ = "agent_task"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent: Mapped[str] = mapped_column(String(60))  # portfolio_manager | research | github ...
    upload_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="queued")  # queued|running|done|error
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    result: Mapped[dict] = mapped_column(JSON, default=dict)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class AgentLog(Base):
    __tablename__ = "agent_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(Integer)
    level: Mapped[str] = mapped_column(String(20), default="info")
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PendingDiff(Base):
    __tablename__ = "pending_diff"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_table: Mapped[str] = mapped_column(String(60))  # publication | project | ...
    action: Mapped[str] = mapped_column(String(20))  # create | update
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[int] = mapped_column(Integer, default=0)  # stored 0..100
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|approved|rejected
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


# ── Visitor history ───────────────────────────────────────────────────────


class ContactMessage(Base):
    __tablename__ = "contact_message"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(200))
    subject: Mapped[str | None] = mapped_column(String(200), nullable=True)
    message: Mapped[str] = mapped_column(Text)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="new")  # new | read | archived
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PageView(Base):
    __tablename__ = "page_view"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    path: Mapped[str] = mapped_column(String(255))
    referrer: Mapped[str | None] = mapped_column(String(500), nullable=True)
    session_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Download(Base):
    __tablename__ = "download"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    resource: Mapped[str] = mapped_column(String(255))  # e.g. "resume" | "papers/pothole-patent.pdf"
    path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    session_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Visitor(Base):
    """A browser session, identified by localStorage session_id.

    `email` and `name` get filled in when the same session submits the
    contact form. Anonymous sessions still get a row so the admin can
    see device fingerprint + activity counts.
    """
    __tablename__ = "visitor"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    first_seen: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CustomField(Base):
    """Admin-managed key/value entries shown on the public site (if is_public)
    or used as internal portfolio metadata. Every mutation is audit-logged.
    """
    __tablename__ = "custom_field"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    kind: Mapped[str] = mapped_column(String(20), default="text")  # text|number|url|json|markdown
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditLog(Base):
    """Append-only record of admin actions and sensitive events."""
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    action: Mapped[str] = mapped_column(String(60), index=True)
    # e.g. admin.login | admin.login_fail | admin.logout |
    #      custom_field.create | custom_field.update | custom_field.delete |
    #      contact.status_change
    actor: Mapped[str] = mapped_column(String(80), default="admin")
    target_table: Mapped[str | None] = mapped_column(String(60), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
