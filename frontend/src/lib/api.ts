export type Profile = {
  id: number;
  name: string;
  title: string;
  tagline: string;
  summary: string;
  email: string;
  phone: string;
  location: string;
  links: Record<string, string>;
};

export type Experience = {
  id: number;
  role: string;
  company: string;
  location: string;
  start_date: string;
  end_date: string;
  description: string;
  order_index: number;
};

export type Education = {
  id: number;
  degree: string;
  institution: string;
  location: string;
  year: string;
};

export type Skill = {
  id: number;
  name: string;
  category: string;
  proficiency: number;
};

export type Project = {
  id: number;
  title: string;
  role: string;
  year: string;
  summary: string;
  achievements: string[];
  tech_stack: string[];
  repo_url?: string | null;
  demo_url?: string | null;
};

export type Publication = {
  id: number;
  title: string;
  authors: string;
  venue: string;
  year: number;
  kind: "journal" | "conference" | "patent";
  doi?: string | null;
  url?: string | null;
};

export type Certification = {
  id: number;
  name: string;
  issuer: string;
  year?: string | null;
};

export type AssistantReply = {
  session_id: string;
  reply: string;
  sources: string[];
  created_at: string;
};

export type AiNewsItem = {
  source: "arxiv" | "hn" | "devto";
  kind: "paper" | "story" | "article";
  title: string;
  url: string;
  summary: string;
  published_at: string;
};

export type AiNewsFeed = {
  count: number;
  items: AiNewsItem[];
};

const CLIENT_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
// On the Next.js server (Node), bypass the dev-server rewrite and call the
// backend container directly. `BACKEND_URL` is set in docker-compose.
const SERVER_BASE = `${process.env.BACKEND_URL ?? "http://backend:4100"}/api`;

function base(): string {
  return typeof window === "undefined" ? SERVER_BASE : CLIENT_BASE;
}

async function safeJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${base()}${path}`, {
      cache: "no-store",
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const api = {
  profile: () => safeJson<Profile>("/profile"),
  education: () => safeJson<Education[]>("/profile/education"),
  certifications: () => safeJson<Certification[]>("/profile/certifications"),
  experience: () => safeJson<Experience[]>("/experience"),
  skills: () => safeJson<Skill[]>("/skills"),
  projects: () => safeJson<Project[]>("/projects"),
  publications: (kind?: string) =>
    safeJson<Publication[]>(`/publications${kind ? `?kind=${kind}` : ""}`),
  chat: (message: string, sessionId: string) =>
    safeJson<AssistantReply>("/assistant/chat", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, message }),
    }),
  aiNews: () => safeJson<AiNewsFeed>("/news/ai"),
  sendContact: (body: {
    name: string;
    email: string;
    subject?: string;
    message: string;
    session_id?: string;
  }) =>
    safeJson<{ ok: boolean; id: number }>("/contact", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  publicCustomFields: () =>
    safeJson<{ key: string; value: string | null; kind: string }[]>("/custom-fields"),
  trackView: (body: { path: string; referrer?: string; session_id?: string }) =>
    safeJson<{ ok: boolean }>("/track/view", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  trackDownload: (body: { resource: string; path?: string; session_id?: string }) =>
    safeJson<{ ok: boolean }>("/track/download", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
