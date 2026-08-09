"use client";

import { useCallback, useEffect, useState } from "react";
import ContentEditor, { type FieldDef, type RowActions } from "./ContentEditor";
import ProfilePhotoField from "./ProfilePhotoField";
import {
  admin,
  type AdminCertification,
  type AdminEducation,
  type AdminExperience,
  type AdminProfile,
  type AdminProject,
  type AdminPublication,
  type AdminSkill,
} from "@/lib/admin";

type Tab =
  | "profile"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "publications"
  | "certifications";

const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "experience", label: "Experience" },
  { key: "education", label: "Qualifications" },
  { key: "skills", label: "Skills" },
  { key: "projects", label: "Projects" },
  { key: "publications", label: "Papers" },
  { key: "certifications", label: "Certifications" },
];

export default function ContentPanels() {
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [experience, setExperience] = useState<AdminExperience[]>([]);
  const [education, setEducation] = useState<AdminEducation[]>([]);
  const [skills, setSkills] = useState<AdminSkill[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [publications, setPublications] = useState<AdminPublication[]>([]);
  const [certifications, setCertifications] = useState<AdminCertification[]>([]);
  // Per-tab "show trash" toggle. When on for a tab, its list refetches
  // with ?trash=1 and the ContentEditor swaps in Restore/Purge actions.
  const [showTrash, setShowTrash] = useState<Record<Tab, boolean>>({
    profile: false,
    experience: false,
    education: false,
    skills: false,
    projects: false,
    publications: false,
    certifications: false,
  });
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [p, ex, ed, sk, pr, pu, ce] = await Promise.all([
      admin.getProfile().catch(() => null),
      admin.experience(showTrash.experience).catch(() => []),
      admin.education(showTrash.education).catch(() => []),
      admin.skills(showTrash.skills).catch(() => []),
      admin.projects(showTrash.projects).catch(() => []),
      admin.publications(showTrash.publications).catch(() => []),
      admin.certifications(showTrash.certifications).catch(() => []),
    ]);
    setProfile(p);
    setExperience(ex);
    setEducation(ed);
    setSkills(sk);
    setProjects(pr);
    setPublications(pu);
    setCertifications(ce);
    setLoaded(true);
  }, [showTrash]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-fetch when the tab regains focus — long admin sessions otherwise
  // see stale data if another tab edits the same content.
  useEffect(() => {
    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [refresh]);

  const toggleTrash = (t: Tab) =>
    setShowTrash((s) => ({ ...s, [t]: !s[t] }));

  return (
    <section>
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="eyebrow">Content</h2>
        <p className="font-mono text-[11px] text-ink-100/55">
          direct edits · auto-reindex the AI agent
        </p>
      </header>

      <nav className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-widest transition ${
              tab === t.key
                ? "border-accent/60 bg-accent/10 text-accent"
                : "border-ink-100/15 text-ink-100/75 hover:border-accent/40 hover:text-accent"
            }`}
          >
            {t.label}
          </button>
        ))}
        {tab !== "profile" && (
          <button
            type="button"
            onClick={() => toggleTrash(tab)}
            className={`ml-auto rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-widest transition ${
              showTrash[tab]
                ? "border-rose/60 bg-rose/10 text-rose"
                : "border-ink-100/15 text-ink-100/75 hover:border-rose/40 hover:text-rose"
            }`}
          >
            {showTrash[tab] ? "← back to active" : "⚙ show trash"}
          </button>
        )}
      </nav>

      {!loaded && (
        <div className="glass rounded-2xl p-5">
          <div className="h-4 w-24 animate-pulse rounded bg-ink-100/10" />
          <div className="mt-3 h-32 animate-pulse rounded-xl bg-ink-100/10" />
        </div>
      )}

      {tab === "profile" && (
        <>
          <ProfilePhotoField
            profile={profile}
            onChanged={(next) => setProfile(next)}
          />
          <ProfileCompleteness profile={profile} />
          <ContentEditor
            singleton
            title="Profile"
            item={profile}
            fields={PROFILE_FIELDS}
            emptyDraft={EMPTY_PROFILE}
            onSave={async (b) => {
              await admin.saveProfile(b);
              await refresh();
            }}
          />
        </>
      )}

      {tab === "experience" && (
        <ContentEditor
          title="Experience"
          items={experience}
          fields={EXPERIENCE_FIELDS}
          emptyDraft={EMPTY_EXPERIENCE}
          labelOf={(e) => `${e.role} · ${e.company}`}
          subtitleOf={(e) => `${e.start_date} — ${e.end_date} · ${e.location}`}
          onCreate={async (b) => { await admin.createExperience(b); await refresh(); }}
          onUpdate={async (id, b, v) => { await admin.updateExperience(id, b, v); await refresh(); }}
          onDelete={async (id) => { await admin.deleteExperience(id); await refresh(); }}
          showingTrash={showTrash.experience}
          rowActions={{
            onPublishToggle: async (it, isPublic) => { await admin.publishExperience(it.id, isPublic); await refresh(); },
            onRestore: async (it) => { await admin.restoreExperience(it.id); await refresh(); },
            onPurge: async (it) => { await admin.deleteExperience(it.id, true); await refresh(); },
            onReorder: async (it, delta) => {
              await admin.updateExperience(
                it.id,
                { ...stripMeta(it), order_index: (it.order_index ?? 0) + delta },
                it.version,
              );
              await refresh();
            },
          } satisfies RowActions<AdminExperience>}
        />
      )}

      {tab === "education" && (
        <ContentEditor
          title="Qualifications"
          items={education}
          fields={EDUCATION_FIELDS}
          emptyDraft={EMPTY_EDUCATION}
          labelOf={(e) => `${e.degree} · ${e.institution}`}
          subtitleOf={(e) => `${e.year} · ${e.location}`}
          onCreate={async (b) => { await admin.createEducation(b); await refresh(); }}
          onUpdate={async (id, b, v) => { await admin.updateEducation(id, b, v); await refresh(); }}
          onDelete={async (id) => { await admin.deleteEducation(id); await refresh(); }}
          showingTrash={showTrash.education}
          rowActions={{
            onPublishToggle: async (it, isPublic) => { await admin.publishEducation(it.id, isPublic); await refresh(); },
            onRestore: async (it) => { await admin.restoreEducation(it.id); await refresh(); },
            onPurge: async (it) => { await admin.deleteEducation(it.id, true); await refresh(); },
            onReorder: async (it, delta) => {
              await admin.updateEducation(
                it.id,
                { ...stripMeta(it), order_index: (it.order_index ?? 0) + delta },
                it.version,
              );
              await refresh();
            },
          } satisfies RowActions<AdminEducation>}
        />
      )}

      {tab === "skills" && (
        <ContentEditor
          title="Skills"
          items={skills}
          fields={SKILL_FIELDS}
          emptyDraft={EMPTY_SKILL}
          labelOf={(s) => `${s.name} · ${s.category}`}
          subtitleOf={(s) => `Proficiency: ${s.proficiency}`}
          onCreate={async (b) => { await admin.createSkill(b); await refresh(); }}
          onUpdate={async (id, b, v) => { await admin.updateSkill(id, b, v); await refresh(); }}
          onDelete={async (id) => { await admin.deleteSkill(id); await refresh(); }}
          showingTrash={showTrash.skills}
          rowActions={{
            onPublishToggle: async (it, isPublic) => { await admin.publishSkill(it.id, isPublic); await refresh(); },
            onRestore: async (it) => { await admin.restoreSkill(it.id); await refresh(); },
            onPurge: async (it) => { await admin.deleteSkill(it.id, true); await refresh(); },
          }}
        />
      )}

      {tab === "projects" && (
        <ContentEditor
          title="Projects"
          items={projects}
          fields={PROJECT_FIELDS}
          emptyDraft={EMPTY_PROJECT}
          labelOf={(p) => `${p.title} (${p.year})`}
          subtitleOf={(p) => `${p.role} · ${p.tech_stack.join(", ")}`}
          onCreate={async (b) => { await admin.createProject(b); await refresh(); }}
          onUpdate={async (id, b, v) => { await admin.updateProject(id, b, v); await refresh(); }}
          onDelete={async (id) => { await admin.deleteProject(id); await refresh(); }}
          showingTrash={showTrash.projects}
          rowActions={{
            onPublishToggle: async (it, isPublic) => { await admin.publishProject(it.id, isPublic); await refresh(); },
            onRestore: async (it) => { await admin.restoreProject(it.id); await refresh(); },
            onPurge: async (it) => { await admin.deleteProject(it.id, true); await refresh(); },
          }}
        />
      )}

      {tab === "publications" && (
        <>
          {!showTrash.publications && <DoiResolver onResolved={refresh} />}
          <ContentEditor
            title="Papers"
            items={publications}
            fields={PUBLICATION_FIELDS}
            emptyDraft={EMPTY_PUBLICATION}
            labelOf={(p) => `${p.title} (${p.year})`}
            subtitleOf={(p) => `${p.kind} · ${p.venue}`}
            onCreate={async (b) => { await admin.createPublication(b); await refresh(); }}
            onUpdate={async (id, b, v) => { await admin.updatePublication(id, b, v); await refresh(); }}
            onDelete={async (id) => { await admin.deletePublication(id); await refresh(); }}
            showingTrash={showTrash.publications}
            rowActions={{
              onPublishToggle: async (it, isPublic) => { await admin.publishPublication(it.id, isPublic); await refresh(); },
              onRestore: async (it) => { await admin.restorePublication(it.id); await refresh(); },
              onPurge: async (it) => { await admin.deletePublication(it.id, true); await refresh(); },
            }}
          />
        </>
      )}

      {tab === "certifications" && (
        <ContentEditor
          title="Certifications"
          items={certifications}
          fields={CERTIFICATION_FIELDS}
          emptyDraft={EMPTY_CERTIFICATION}
          labelOf={(c) => c.name}
          subtitleOf={(c) => `${c.issuer}${c.year ? ` · ${c.year}` : ""}`}
          onCreate={async (b) => { await admin.createCertification(b); await refresh(); }}
          onUpdate={async (id, b, v) => { await admin.updateCertification(id, b, v); await refresh(); }}
          onDelete={async (id) => { await admin.deleteCertification(id); await refresh(); }}
          showingTrash={showTrash.certifications}
          rowActions={{
            onPublishToggle: async (it, isPublic) => { await admin.publishCertification(it.id, isPublic); await refresh(); },
            onRestore: async (it) => { await admin.restoreCertification(it.id); await refresh(); },
            onPurge: async (it) => { await admin.deleteCertification(it.id, true); await refresh(); },
          }}
        />
      )}
    </section>
  );
}

// Drops server-managed metadata so a spread of an item into an *Input
// payload doesn't ship version/is_public/deleted_at back to the server.
function stripMeta<T extends { id?: unknown; version?: unknown; is_public?: unknown; deleted_at?: unknown }>(
  it: T,
): Omit<T, "id" | "version" | "is_public" | "deleted_at"> {
  const { id: _id, version: _v, is_public: _p, deleted_at: _d, ...rest } = it;
  void _id;
  void _v;
  void _p;
  void _d;
  return rest;
}

function ProfileCompleteness({ profile }: { profile: AdminProfile | null }) {
  if (!profile) return null;
  const checks: [string, boolean][] = [
    ["Name", !!profile.name?.trim()],
    ["Title", !!profile.title?.trim()],
    ["Tagline", !!profile.tagline?.trim()],
    ["Summary", (profile.summary?.trim().length ?? 0) >= 40],
    ["Email", /@/.test(profile.email ?? "")],
    ["Location", !!profile.location?.trim()],
    ["Photo", !!profile.photo_url],
    ["Links", Object.keys(profile.links ?? {}).length > 0],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  const pct = Math.round((done / checks.length) * 100);
  const barTone = pct === 100 ? "bg-accent" : pct >= 60 ? "bg-plum" : "bg-rose";
  return (
    <div className="mb-4 rounded-xl border border-ink-100/15 bg-ink-950/30 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-100/55">
          Profile completeness · {done} / {checks.length}
        </p>
        <span className="font-mono text-[11px] text-ink-100/70">{pct}%</span>
      </div>
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-100/10">
        <div
          className={`h-full ${barTone} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px]">
        {checks.map(([label, ok]) => (
          <li key={label} className={ok ? "text-accent/90" : "text-ink-100/45"}>
            {ok ? "✓" : "○"} {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Field schemas + empty drafts ─────────────────────────────────────────

const PROFILE_FIELDS: FieldDef[] = [
  { key: "name", label: "Name" },
  { key: "title", label: "Title" },
  { key: "tagline", label: "Tagline", span: 2 },
  { key: "summary", label: "Summary", type: "textarea", span: 2, max: 2000 },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "location", label: "Location", span: 2 },
  { key: "links", label: "Links (label → URL)", type: "linkmap", span: 2 },
];

const EMPTY_PROFILE = {
  name: "",
  title: "",
  tagline: "",
  summary: "",
  email: "",
  phone: "",
  location: "",
  links: {} as Record<string, string>,
  photo_url: null as string | null,
};

const EXPERIENCE_FIELDS: FieldDef[] = [
  { key: "role", label: "Role" },
  { key: "company", label: "Company" },
  { key: "location", label: "Location" },
  { key: "start_date", label: "Start date" },
  { key: "end_date", label: "End date" },
  { key: "order_index", label: "Order index", type: "number" },
  { key: "description", label: "Description", type: "textarea", span: 2, max: 2000 },
];

const EMPTY_EXPERIENCE = {
  role: "",
  company: "",
  location: "",
  start_date: "",
  end_date: "",
  description: "",
  order_index: 0,
};

const EDUCATION_FIELDS: FieldDef[] = [
  { key: "degree", label: "Degree" },
  { key: "institution", label: "Institution" },
  { key: "location", label: "Location" },
  { key: "year", label: "Year" },
  { key: "order_index", label: "Order index", type: "number" },
];

const EMPTY_EDUCATION = {
  degree: "",
  institution: "",
  location: "",
  year: "",
  order_index: 0,
};

const SKILL_FIELDS: FieldDef[] = [
  { key: "name", label: "Name" },
  { key: "category", label: "Category", placeholder: "AI / Backend / DevOps ..." },
  { key: "proficiency", label: "Proficiency (0-100)", type: "number" },
];

const EMPTY_SKILL = { name: "", category: "general", proficiency: 80 };

const PROJECT_FIELDS: FieldDef[] = [
  { key: "title", label: "Title", span: 2 },
  { key: "role", label: "Role" },
  { key: "year", label: "Year" },
  { key: "summary", label: "Summary", type: "textarea", span: 2, max: 1500 },
  { key: "achievements", label: "Achievements (comma-sep)", type: "list", span: 2 },
  { key: "tech_stack", label: "Tech stack (comma-sep)", type: "list", span: 2 },
  { key: "repo_url", label: "Repo URL", type: "url" },
  { key: "demo_url", label: "Demo URL", type: "url" },
];

const EMPTY_PROJECT = {
  title: "",
  role: "",
  year: "",
  summary: "",
  achievements: [] as string[],
  tech_stack: [] as string[],
  repo_url: null as string | null,
  demo_url: null as string | null,
};

const PUBLICATION_FIELDS: FieldDef[] = [
  { key: "title", label: "Title", span: 2 },
  { key: "authors", label: "Authors", span: 2 },
  { key: "venue", label: "Venue", span: 2 },
  { key: "year", label: "Year", type: "number" },
  {
    key: "kind",
    label: "Kind",
    type: "select",
    options: ["journal", "conference", "patent"],
  },
  { key: "doi", label: "DOI" },
  { key: "url", label: "URL", type: "url" },
];

const EMPTY_PUBLICATION = {
  title: "",
  authors: "",
  venue: "",
  year: new Date().getFullYear(),
  kind: "journal" as const,
  doi: null as string | null,
  url: null as string | null,
};

const CERTIFICATION_FIELDS: FieldDef[] = [
  { key: "name", label: "Name", span: 2 },
  { key: "issuer", label: "Issuer" },
  { key: "year", label: "Year" },
];

const EMPTY_CERTIFICATION = { name: "", issuer: "", year: null as string | null };

// ── DOI paste → Crossref → auto-create publication ────────────────────

function DoiResolver({ onResolved }: { onResolved: () => Promise<void> }) {
  const [doi, setDoi] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function fetchAndCreate() {
    if (!doi.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const resolved = await admin.resolveDoi(doi.trim());
      // resolveDoi returns exactly PublicationInput-shaped fields (Crossref
      // → normalized). Create the row directly; the admin can Edit it after.
      await admin.createPublication({
        title: resolved.title,
        authors: resolved.authors,
        venue: resolved.venue,
        year: resolved.year,
        kind: resolved.kind,
        doi: resolved.doi,
        url: resolved.url,
      });
      setDoi("");
      setMsg({ tone: "ok", text: `Imported "${resolved.title || resolved.doi}"` });
      await onResolved();
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass mb-4 rounded-2xl p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-ink-50">Import by DOI</h3>
        <span className="font-mono text-[11px] text-ink-100/55">
          Paste a DOI → auto-fill from Crossref
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={doi}
          onChange={(e) => setDoi(e.target.value)}
          placeholder="10.1000/xyz123  ·  or  https://doi.org/10.1000/xyz123"
          className="flex-1 rounded-full border border-ink-100/15 bg-white/70 px-3 py-1.5 text-sm text-ink-50 outline-none focus:border-accent/60"
        />
        <button
          type="button"
          onClick={fetchAndCreate}
          disabled={busy || !doi.trim()}
          className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white transition hover:bg-accent-soft disabled:opacity-40"
        >
          {busy ? "Fetching…" : "Import"}
        </button>
      </div>
      {msg && (
        <p
          className={`mt-2 font-mono text-[11px] ${
            msg.tone === "ok" ? "text-accent" : "text-rose"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
