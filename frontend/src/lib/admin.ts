const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
const TOKEN_KEY = "vasudevan_admin_token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function authed<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  if (!token) throw new Error("not authenticated");
  const res = await fetch(`${BASE}/admin${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) {
    clearAdminToken();
    throw new Error("unauthorized");
  }
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
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

// Login is the only POST that runs WITHOUT an existing token. After it
// succeeds we store the token client-side and use authed() for everything.
export async function adminLogin(token: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    cache: "no-store",
  });
  if (res.status === 403) throw new Error("bad admin token");
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  setAdminToken(token);
  return (await res.json()) as { ok: boolean };
}

export const admin = {
  ping: () => authed<AdminStats>("/stats"),
  logout: () => authed<{ ok: boolean }>("/logout", { method: "POST" }),
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
  contacts: () => authed<AdminContact[]>("/contacts"),
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
  audit: (limit = 200, actionPrefix?: string) =>
    authed<AdminAuditEntry[]>(
      `/audit?limit=${limit}${actionPrefix ? `&action_prefix=${encodeURIComponent(actionPrefix)}` : ""}`,
    ),
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
};
