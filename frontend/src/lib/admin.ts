const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

// Thrown by authed() on 401 so callers can redirect to /admin/login instead
// of surfacing a scary "not signed in" toast.
export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "UnauthorizedError";
  }
}

async function authed<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/admin${path}`, {
    ...init,
    credentials: "include", // session cookie
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(await friendlyError(res));
  return (await res.json()) as T;
}

async function friendlyError(res: Response): Promise<string> {
  // FastAPI shapes:
  //   422 → { detail: [{ loc: [..., field], msg, type }, ...] }
  //   4xx/5xx with HTTPException → { detail: "string" }
  //   otherwise plain text
  const raw = await res.text();
  try {
    const parsed = JSON.parse(raw);
    const d = parsed?.detail;
    if (Array.isArray(d)) {
      return d
        .map((v: { loc?: unknown[]; msg?: string }) => {
          const field = Array.isArray(v.loc)
            ? v.loc.filter((x) => x !== "body").join(".")
            : "";
          return field ? `${field}: ${v.msg ?? "invalid"}` : (v.msg ?? "invalid");
        })
        .join(" · ");
    }
    if (typeof d === "string") return d;
  } catch {
    /* not JSON — fall through */
  }
  return raw || res.statusText || `HTTP ${res.status}`;
}

export type AdminStats = {
  uploads: number;
  agent_tasks: number;
  pending_diffs: number;
  pending_review: number;
  publications: number;
  projects: number;
  vector_chunks: number;
  contacts: number;
  page_views: number;
  downloads: number;
};

export type AdminContact = {
  id: number;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: "new" | "read" | "archived";
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

export type AdminView = {
  id: number;
  path: string;
  referrer: string | null;
  session_id: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

export type AdminDownload = {
  id: number;
  resource: string;
  path: string | null;
  session_id: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

export type AdminViewStats = {
  total: number;
  unique_sessions: number;
  unique_ips: number;
  by_path: { path: string; count: number }[];
};

export type AdminDailyPoint = {
  date: string;     // YYYY-MM-DD
  views: number;
  contacts: number;
  downloads: number;
};

export type AdminDailyAnalytics = {
  days: number;
  series: AdminDailyPoint[];
};

export type AdminVisitor = {
  id: number;
  session_id: string;
  email: string | null;
  name: string | null;
  ip: string | null;
  user_agent: string | null;
  first_seen: string;
  last_seen: string;
  views: number;
  downloads: number;
  messages: number;
};

export type AdminCustomField = {
  id: number;
  key: string;
  value: string | null;
  kind: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminCustomFieldInput = {
  key: string;
  value: string | null;
  kind: string;
  description: string | null;
  is_public: boolean;
};

export type AdminAuditEntry = {
  id: number;
  action: string;
  actor: string;
  target_table: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

export type AdminAuditPage = {
  total: number;
  limit: number;
  offset: number;
  entries: AdminAuditEntry[];
};

export type AdminAuditQuery = {
  limit?: number;
  offset?: number;
  actionPrefix?: string;
  actor?: string;
  targetTable?: string;
};

export type AdminUpload = {
  id: number;
  filename: string;
  status: string;
  size_bytes: number;
  created_at: string;
};

export type AdminTask = {
  id: number;
  agent: string;
  status: string;
  upload_id: number | null;
  result: Record<string, unknown>;
  error: string | null;
  created_at: string;
  finished_at: string | null;
};

export type AdminDiff = {
  id: number;
  task_id: number | null;
  target_table: string;
  action: "create" | "update";
  payload: Record<string, unknown>;
  evidence: string | null;
  confidence: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

// ── Content CRUD types ───────────────────────────────────────────────────

export type AdminProfile = {
  id: number;
  name: string;
  title: string;
  tagline: string;
  summary: string;
  email: string;
  phone: string;
  location: string;
  links: Record<string, string>;
  photo_url: string | null;
};

// Metadata every mutable-list entity carries.
export type ContentMeta = {
  version: number;
  is_public: boolean;
  deleted_at: string | null;
};

export type AdminExperience = ContentMeta & {
  id: number;
  role: string;
  company: string;
  location: string;
  start_date: string;
  end_date: string;
  description: string;
  order_index: number;
};

export type AdminEducation = ContentMeta & {
  id: number;
  degree: string;
  institution: string;
  location: string;
  year: string;
  order_index: number;
};

export type AdminSkill = ContentMeta & {
  id: number;
  name: string;
  category: string;
  proficiency: number;
};

export type AdminProject = ContentMeta & {
  id: number;
  title: string;
  role: string;
  year: string;
  summary: string;
  achievements: string[];
  tech_stack: string[];
  repo_url: string | null;
  demo_url: string | null;
};

export type AdminPublication = ContentMeta & {
  id: number;
  title: string;
  authors: string;
  venue: string;
  year: number;
  kind: "journal" | "conference" | "patent";
  doi: string | null;
  url: string | null;
};

export type AdminCertification = ContentMeta & {
  id: number;
  name: string;
  issuer: string;
  year: string | null;
};

// Input shapes exclude id + the server-owned metadata fields.
type StripMeta<T> = Omit<T, "id" | "version" | "is_public" | "deleted_at">;

export type ProfileInput = Omit<AdminProfile, "id">;
export type ExperienceInput = StripMeta<AdminExperience>;
export type EducationInput = StripMeta<AdminEducation>;
export type SkillInput = StripMeta<AdminSkill>;
export type ProjectInput = StripMeta<AdminProject>;
export type PublicationInput = StripMeta<AdminPublication>;
export type CertificationInput = StripMeta<AdminCertification>;

// Crossref → PublicationIn shape returned by /admin/content/publications/resolve-doi.
export type ResolvedDoi = {
  title: string;
  authors: string;
  venue: string;
  year: number;
  kind: "journal" | "conference" | "patent";
  doi: string;
  url: string;
};

export type AdminSessionInfo = {
  id: string;
  is_current: boolean;
  created_at: string;
  last_seen: string;
  expires_at: string;
  ip: string | null;
  user_agent: string | null;
};

// ── Auth types ──────────────────────────────────────────────────────────

export type AuthStatus = { needs_setup: boolean };
export type AuthedUserInfo = { id: number; email: string; totp_enabled: boolean };
export type LoginResponse =
  | { ok: true; user: AuthedUserInfo }
  | { needs_2fa: true; challenge: string };
export type TwoFASetupResponse = {
  secret: string;
  provisioning_uri: string;
  // Base64 PNG data URL — drop straight into an <img src=…>.
  qr_png: string;
  backup_codes: string[];
};

// Public (no cookie required) — hits /admin/auth/* without the guard.
async function publicAuth<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/admin/auth${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await friendlyError(res));
  return (await res.json()) as T;
}

export const auth = {
  status: () => publicAuth<AuthStatus>("/status"),
  setup: (email: string, password: string) =>
    publicAuth<{ ok: true; user: AuthedUserInfo }>("/setup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    publicAuth<LoginResponse>("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  submit2fa: (challenge: string, code: string) =>
    publicAuth<{ ok: true; user: AuthedUserInfo }>("/2fa", {
      method: "POST",
      body: JSON.stringify({ challenge, code }),
    }),
  me: () => authed<AuthedUserInfo>("/auth/me"),
  logout: () => authed<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  changePassword: (current_password: string, new_password: string) =>
    authed<{ ok: boolean }>("/auth/password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),
  setup2fa: () => authed<TwoFASetupResponse>("/auth/2fa/setup"),
  enable2fa: (code: string) =>
    authed<{ ok: boolean }>("/auth/2fa/enable", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  disable2fa: (password: string, code: string) =>
    authed<{ ok: boolean }>("/auth/2fa/disable", {
      method: "POST",
      body: JSON.stringify({ password, code }),
    }),
  listSessions: () => authed<AdminSessionInfo[]>("/auth/sessions"),
  revokeSession: (sid: string) =>
    authed<{ ok: boolean; id: string }>(`/auth/sessions/${sid}/revoke`, { method: "POST" }),
  revokeOtherSessions: () =>
    authed<{ ok: boolean; revoked: number }>("/auth/sessions/revoke-others", { method: "POST" }),
};

export const admin = {
  ping: () => authed<AdminStats>("/stats"),
  stats: () => authed<AdminStats>("/stats"),
  uploads: () => authed<AdminUpload[]>("/uploads"),
  tasks: () => authed<AdminTask[]>("/tasks"),
  diffs: (status?: string) =>
    authed<AdminDiff[]>(`/diffs${status ? `?status_filter=${status}` : ""}`),
  approve: (id: number) =>
    authed<{ id: number; status: string }>(`/diffs/${id}/approve`, { method: "POST" }),
  reject: (id: number) =>
    authed<{ id: number; status: string }>(`/diffs/${id}/reject`, { method: "POST" }),
  reindex: () => authed<{ chunks_indexed: number }>("/reindex", { method: "POST" }),
  contacts: (limit = 200) => authed<AdminContact[]>(`/contacts?limit=${limit}`),
  setContactStatus: (id: number, status: "new" | "read" | "archived") =>
    authed<{ id: number; status: string }>(`/contacts/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  views: (limit = 100) => authed<AdminView[]>(`/views?limit=${limit}`),
  viewStats: () => authed<AdminViewStats>("/views/stats"),
  downloads: (limit = 100) => authed<AdminDownload[]>(`/downloads?limit=${limit}`),
  dailyAnalytics: (days = 30) =>
    authed<AdminDailyAnalytics>(`/analytics/daily?days=${days}`),
  upload: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return authed<{ upload_id: number; task_id: number; status: string }>("/uploads", {
      method: "POST",
      body: fd,
    });
  },
  visitors: (limit = 100) => authed<AdminVisitor[]>(`/visitors?limit=${limit}`),
  audit: (q: AdminAuditQuery = {}) => {
    const params = new URLSearchParams();
    params.set("limit", String(q.limit ?? 50));
    params.set("offset", String(q.offset ?? 0));
    if (q.actionPrefix) params.set("action_prefix", q.actionPrefix);
    if (q.actor) params.set("actor", q.actor);
    if (q.targetTable) params.set("target_table", q.targetTable);
    return authed<AdminAuditPage>(`/audit?${params.toString()}`);
  },
  customFields: () => authed<AdminCustomField[]>("/custom-fields"),
  createCustomField: (body: AdminCustomFieldInput) =>
    authed<AdminCustomField>("/custom-fields", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateCustomField: (id: number, body: AdminCustomFieldInput) =>
    authed<AdminCustomField>(`/custom-fields/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteCustomField: (id: number) =>
    authed<{ ok: boolean; id: number }>(`/custom-fields/${id}`, { method: "DELETE" }),

  // ── Content CRUD ────────────────────────────────────────────────────
  getProfile: () => authed<AdminProfile>("/content/profile"),
  saveProfile: (body: ProfileInput) =>
    authed<AdminProfile>("/content/profile", { method: "PUT", body: JSON.stringify(body) }),
  uploadProfilePhoto: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return authed<AdminProfile>("/content/profile/photo", {
      method: "POST",
      body: fd,
    });
  },
  deleteProfilePhoto: () =>
    authed<AdminProfile>("/content/profile/photo", { method: "DELETE" }),

  // Per-entity CRUD with optimistic-lock support. On PUT, callers may pass
  // an `expectedVersion` (from the row they loaded); the server rejects
  // with 409 if another tab wrote first. Trash / restore / publish share
  // the same shape via the generic helpers below.
  experience: (trash = false) =>
    authed<AdminExperience[]>(`/content/experience${trash ? "?trash=1" : ""}`),
  createExperience: (b: ExperienceInput) =>
    authed<AdminExperience>("/content/experience", { method: "POST", body: JSON.stringify(b) }),
  updateExperience: (id: number, b: ExperienceInput, expectedVersion?: number) =>
    authed<AdminExperience>(`/content/experience/${id}`, {
      method: "PUT",
      body: JSON.stringify(b),
      headers: expectedVersion !== undefined ? { "If-Match": String(expectedVersion) } : {},
    }),
  deleteExperience: (id: number, hard = false) =>
    authed<{ ok: boolean; id: number }>(
      `/content/experience/${id}${hard ? "?hard=1" : ""}`,
      { method: "DELETE" },
    ),
  restoreExperience: (id: number) =>
    authed<AdminExperience>(`/content/experience/${id}/restore`, { method: "POST" }),
  publishExperience: (id: number, is_public: boolean) =>
    authed<AdminExperience>(`/content/experience/${id}/publish`, {
      method: "POST",
      body: JSON.stringify({ is_public }),
    }),

  education: (trash = false) =>
    authed<AdminEducation[]>(`/content/education${trash ? "?trash=1" : ""}`),
  createEducation: (b: EducationInput) =>
    authed<AdminEducation>("/content/education", { method: "POST", body: JSON.stringify(b) }),
  updateEducation: (id: number, b: EducationInput, expectedVersion?: number) =>
    authed<AdminEducation>(`/content/education/${id}`, {
      method: "PUT",
      body: JSON.stringify(b),
      headers: expectedVersion !== undefined ? { "If-Match": String(expectedVersion) } : {},
    }),
  deleteEducation: (id: number, hard = false) =>
    authed<{ ok: boolean; id: number }>(
      `/content/education/${id}${hard ? "?hard=1" : ""}`,
      { method: "DELETE" },
    ),
  restoreEducation: (id: number) =>
    authed<AdminEducation>(`/content/education/${id}/restore`, { method: "POST" }),
  publishEducation: (id: number, is_public: boolean) =>
    authed<AdminEducation>(`/content/education/${id}/publish`, {
      method: "POST",
      body: JSON.stringify({ is_public }),
    }),

  skills: (trash = false) =>
    authed<AdminSkill[]>(`/content/skills${trash ? "?trash=1" : ""}`),
  createSkill: (b: SkillInput) =>
    authed<AdminSkill>("/content/skills", { method: "POST", body: JSON.stringify(b) }),
  updateSkill: (id: number, b: SkillInput, expectedVersion?: number) =>
    authed<AdminSkill>(`/content/skills/${id}`, {
      method: "PUT",
      body: JSON.stringify(b),
      headers: expectedVersion !== undefined ? { "If-Match": String(expectedVersion) } : {},
    }),
  deleteSkill: (id: number, hard = false) =>
    authed<{ ok: boolean; id: number }>(
      `/content/skills/${id}${hard ? "?hard=1" : ""}`,
      { method: "DELETE" },
    ),
  restoreSkill: (id: number) =>
    authed<AdminSkill>(`/content/skills/${id}/restore`, { method: "POST" }),
  publishSkill: (id: number, is_public: boolean) =>
    authed<AdminSkill>(`/content/skills/${id}/publish`, {
      method: "POST",
      body: JSON.stringify({ is_public }),
    }),

  projects: (trash = false) =>
    authed<AdminProject[]>(`/content/projects${trash ? "?trash=1" : ""}`),
  createProject: (b: ProjectInput) =>
    authed<AdminProject>("/content/projects", { method: "POST", body: JSON.stringify(b) }),
  updateProject: (id: number, b: ProjectInput, expectedVersion?: number) =>
    authed<AdminProject>(`/content/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(b),
      headers: expectedVersion !== undefined ? { "If-Match": String(expectedVersion) } : {},
    }),
  deleteProject: (id: number, hard = false) =>
    authed<{ ok: boolean; id: number }>(
      `/content/projects/${id}${hard ? "?hard=1" : ""}`,
      { method: "DELETE" },
    ),
  restoreProject: (id: number) =>
    authed<AdminProject>(`/content/projects/${id}/restore`, { method: "POST" }),
  publishProject: (id: number, is_public: boolean) =>
    authed<AdminProject>(`/content/projects/${id}/publish`, {
      method: "POST",
      body: JSON.stringify({ is_public }),
    }),

  publications: (trash = false) =>
    authed<AdminPublication[]>(`/content/publications${trash ? "?trash=1" : ""}`),
  createPublication: (b: PublicationInput) =>
    authed<AdminPublication>("/content/publications", { method: "POST", body: JSON.stringify(b) }),
  updatePublication: (id: number, b: PublicationInput, expectedVersion?: number) =>
    authed<AdminPublication>(`/content/publications/${id}`, {
      method: "PUT",
      body: JSON.stringify(b),
      headers: expectedVersion !== undefined ? { "If-Match": String(expectedVersion) } : {},
    }),
  deletePublication: (id: number, hard = false) =>
    authed<{ ok: boolean; id: number }>(
      `/content/publications/${id}${hard ? "?hard=1" : ""}`,
      { method: "DELETE" },
    ),
  restorePublication: (id: number) =>
    authed<AdminPublication>(`/content/publications/${id}/restore`, { method: "POST" }),
  publishPublication: (id: number, is_public: boolean) =>
    authed<AdminPublication>(`/content/publications/${id}/publish`, {
      method: "POST",
      body: JSON.stringify({ is_public }),
    }),
  resolveDoi: (doi: string) =>
    authed<ResolvedDoi>(`/content/publications/resolve-doi?doi=${encodeURIComponent(doi)}`),

  certifications: (trash = false) =>
    authed<AdminCertification[]>(`/content/certifications${trash ? "?trash=1" : ""}`),
  createCertification: (b: CertificationInput) =>
    authed<AdminCertification>("/content/certifications", { method: "POST", body: JSON.stringify(b) }),
  updateCertification: (id: number, b: CertificationInput, expectedVersion?: number) =>
    authed<AdminCertification>(`/content/certifications/${id}`, {
      method: "PUT",
      body: JSON.stringify(b),
      headers: expectedVersion !== undefined ? { "If-Match": String(expectedVersion) } : {},
    }),
  deleteCertification: (id: number, hard = false) =>
    authed<{ ok: boolean; id: number }>(
      `/content/certifications/${id}${hard ? "?hard=1" : ""}`,
      { method: "DELETE" },
    ),
  restoreCertification: (id: number) =>
    authed<AdminCertification>(`/content/certifications/${id}/restore`, { method: "POST" }),
  publishCertification: (id: number, is_public: boolean) =>
    authed<AdminCertification>(`/content/certifications/${id}/publish`, {
      method: "POST",
      body: JSON.stringify({ is_public }),
    }),

  // Exports — URL-only helpers. The href triggers a browser download
  // directly; no need to fetch through the client (large payloads would
  // otherwise land in memory).
  exportUrl: (which: "audit" | "contacts" | "downloads", fmt: "csv" | "json" = "csv") =>
    `${BASE}/admin/export/${which}?fmt=${fmt}`,
};
