"use client";

import { useCallback, useEffect, useState } from "react";
import AuditLogPanel from "@/components/admin/AuditLogPanel";
import CustomFieldsPanel from "@/components/admin/CustomFieldsPanel";
import DailyChart from "@/components/admin/DailyChart";
import VisitorsPanel from "@/components/admin/VisitorsPanel";
import {
  admin,
  adminLogin,
  clearAdminToken,
  getAdminToken,
  type AdminAuditEntry,
  type AdminContact,
  type AdminCustomField,
  type AdminDailyAnalytics,
  type AdminDiff,
  type AdminDownload,
  type AdminStats,
  type AdminTask,
  type AdminUpload,
  type AdminView,
  type AdminViewStats,
  type AdminVisitor,
} from "@/lib/admin";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [diffs, setDiffs] = useState<AdminDiff[]>([]);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [uploads, setUploads] = useState<AdminUpload[]>([]);
  const [contacts, setContacts] = useState<AdminContact[]>([]);
  const [views, setViews] = useState<AdminView[]>([]);
  const [viewStats, setViewStats] = useState<AdminViewStats | null>(null);
  const [downloads, setDownloads] = useState<AdminDownload[]>([]);
  const [daily, setDaily] = useState<AdminDailyAnalytics | null>(null);
  const [visitors, setVisitors] = useState<AdminVisitor[]>([]);
  const [customFields, setCustomFields] = useState<AdminCustomField[]>([]);
  const [auditEntries, setAuditEntries] = useState<AdminAuditEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, d, t, u, c, v, vs, dl, da, vis, cf, au] = await Promise.all([
        admin.stats(),
        admin.diffs(),
        admin.tasks(),
        admin.uploads(),
        admin.contacts(),
        admin.views(50),
        admin.viewStats(),
        admin.downloads(50),
        admin.dailyAnalytics(30),
        admin.visitors(100),
        admin.customFields(),
        admin.audit(120),
      ]);
      setStats(s);
      setDiffs(d);
      setTasks(t);
      setUploads(u);
      setContacts(c);
      setViews(v);
      setViewStats(vs);
      setDownloads(dl);
      setDaily(da);
      setVisitors(vis);
      setCustomFields(cf);
      setAuditEntries(au);
    } catch (e) {
      if ((e as Error).message === "unauthorized") setAuthed(false);
    }
  }, []);

  useEffect(() => {
    if (!getAdminToken()) return;
    admin
      .ping()
      .then(() => {
        setAuthed(true);
        refresh();
      })
      .catch(() => setAuthed(false));
  }, [refresh]);

  useEffect(() => {
    if (!authed) return;
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [authed, refresh]);

  async function login(token: string) {
    try {
      await adminLogin(token);
      setAuthed(true);
      setAuthError(null);
      await refresh();
    } catch (e) {
      clearAdminToken();
      setAuthError((e as Error).message);
    }
  }

  async function signOut() {
    try {
      await admin.logout();
    } catch {
      /* ignore — still clear token below */
    }
    clearAdminToken();
    setAuthed(false);
  }

  async function handleUpload(file: File) {
    setBusy(true);
    try {
      const res = await admin.upload(file);
      setFlash(`Queued · upload #${res.upload_id} → task #${res.task_id}`);
      await refresh();
    } catch (e) {
      setFlash(`Upload failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function approve(id: number) {
    try {
      await admin.approve(id);
      setFlash(`Approved diff #${id} — applied to portfolio.`);
      await refresh();
    } catch (e) {
      setFlash(`Approve failed: ${(e as Error).message}`);
    }
  }

  async function reject(id: number) {
    await admin.reject(id);
    setFlash(`Rejected diff #${id}.`);
    await refresh();
  }

  async function reindex() {
    setBusy(true);
    try {
      const res = await admin.reindex();
      setFlash(`Reindexed ${res.chunks_indexed} chunks.`);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!authed) return <LoginCard onSubmit={login} error={authError} />;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:px-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-accent/80">
            // admin · portfolio manager
          </p>
          <h1 className="mt-2 font-display text-display-lg leading-[0.95]">
            Control room.
          </h1>
        </div>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            disabled={busy}
            onClick={reindex}
            className="glass rounded-full px-4 py-2 transition hover:border-accent/60 disabled:opacity-40"
          >
            Reindex vectors
          </button>
          <button
            type="button"
            onClick={signOut}
            className="glass rounded-full px-4 py-2 transition hover:border-rose/60"
          >
            Sign out
          </button>
        </div>
      </header>

      {flash && (
        <div className="glass mb-6 rounded-xl border-accent/30 px-4 py-3 font-mono text-xs text-accent">
          {flash}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {stats &&
          [
            ["Pending review", stats.pending_review, "accent"],
            ["Vector chunks", stats.vector_chunks, "plum"],
            ["Uploads", stats.uploads, "ink"],
            ["Publications", stats.publications, "ink"],
          ].map(([label, value, tone]) => (
            <div key={label as string} className="glass rounded-2xl p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-100/55">
                {label as string}
              </p>
              <p
                className={`mt-2 font-display text-4xl ${
                  tone === "accent"
                    ? "text-accent"
                    : tone === "plum"
                      ? "text-plum"
                      : "text-ink-50"
                }`}
              >
                {value as number}
              </p>
            </div>
          ))}
      </div>

      {/* Visitors */}
      <section className="mt-10 space-y-6">
        <header className="flex items-baseline justify-between gap-3">
          <h2 className="eyebrow">Visitor history</h2>
          {viewStats && (
            <p className="font-mono text-xs text-ink-100/55">
              {viewStats.total} views · {viewStats.unique_sessions} sessions · {viewStats.unique_ips} IPs
            </p>
          )}
        </header>

        {daily && (
          <div className="glass rounded-2xl p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-medium text-ink-50">
                Daily activity <span className="text-ink-100/55">· last {daily.days} days</span>
              </h3>
            </div>
            <DailyChart series={daily.series} />
          </div>
        )}

        <VisitorsPanel visitors={visitors} />
        <CustomFieldsPanel fields={customFields} onChanged={refresh} />
        <AuditLogPanel entries={auditEntries} />

        {/* Contact messages */}
        <div className="glass rounded-2xl p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-medium text-ink-50">
              Contact messages <span className="text-ink-100/55">· {contacts.length}</span>
            </h3>
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink-100/55">
              new · read · archived
            </span>
          </div>
          {contacts.length === 0 ? (
            <p className="text-sm text-ink-100/55">No contact messages yet.</p>
          ) : (
            <ul className="divide-y divide-ink-100/10">
              {contacts.map((c) => (
                <li key={c.id} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink-50">
                      {c.name} <span className="font-mono text-xs text-ink-100/55">&lt;{c.email}&gt;</span>
                    </span>
                    <span className="flex items-center gap-2 font-mono text-[11px] text-ink-100/55">
                      <span>{formatDate(c.created_at)}</span>
                      <ContactStatusButton
                        contact={c}
                        onChange={async (status) => {
                          await admin.setContactStatus(c.id, status);
                          await refresh();
                        }}
                      />
                    </span>
                  </div>
                  {c.subject && (
                    <p className="mt-1 text-xs italic text-ink-100/65">re: {c.subject}</p>
                  )}
                  <p className="mt-1 whitespace-pre-line text-sm text-ink-100/85">{c.message}</p>
                  <p className="mt-1 font-mono text-[11px] text-ink-100/45">
                    {c.ip ?? "-"} · {(c.user_agent ?? "").slice(0, 70)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Page views + downloads side-by-side */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="glass rounded-2xl p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-medium text-ink-50">Page views</h3>
              <span className="font-mono text-[11px] text-ink-100/55">
                last {views.length}
              </span>
            </div>
            {viewStats && viewStats.by_path.length > 0 && (
              <div className="mb-3 space-y-1">
                {viewStats.by_path.slice(0, 6).map((b) => (
                  <div key={b.path} className="flex items-center justify-between text-xs">
                    <span className="truncate font-mono text-ink-100/75">{b.path}</span>
                    <span className="ml-2 rounded-full border border-accent/30 px-2 py-px font-mono text-[11px] text-accent/90">
                      {b.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <ul className="max-h-64 divide-y divide-ink-100/10 overflow-y-auto">
              {views.map((v) => (
                <li key={v.id} className="py-1.5 text-[11px] leading-snug">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-mono text-ink-50">{v.path}</span>
                    <span className="font-mono text-ink-100/55">{formatDate(v.created_at)}</span>
                  </div>
                  <p className="font-mono text-ink-100/45">
                    {v.ip ?? "-"} · sid {v.session_id?.slice(-6) ?? "—"}
                  </p>
                </li>
              ))}
              {views.length === 0 && (
                <li className="py-2 text-xs text-ink-100/55">No page views yet.</li>
              )}
            </ul>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-medium text-ink-50">Downloads</h3>
              <span className="font-mono text-[11px] text-ink-100/55">
                last {downloads.length}
              </span>
            </div>
            <ul className="max-h-64 divide-y divide-ink-100/10 overflow-y-auto">
              {downloads.map((d) => (
                <li key={d.id} className="py-1.5 text-[11px] leading-snug">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-ink-50">
                      <span className="mr-2 rounded-full border border-accent/30 px-2 py-px font-mono text-accent/90">
                        {d.resource}
                      </span>
                      <span className="font-mono text-ink-100/65">{d.path}</span>
                    </span>
                    <span className="font-mono text-ink-100/55">{formatDate(d.created_at)}</span>
                  </div>
                  <p className="font-mono text-ink-100/45">
                    {d.ip ?? "-"} · sid {d.session_id?.slice(-6) ?? "—"}
                  </p>
                </li>
              ))}
              {downloads.length === 0 && (
                <li className="py-2 text-xs text-ink-100/55">No downloads yet.</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* Upload */}
      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <UploadCard busy={busy} onUpload={handleUpload} />

        <div className="glass rounded-2xl p-6">
          <h2 className="eyebrow mb-4">Recent uploads</h2>
          <ul className="space-y-2 text-xs">
            {uploads.slice(0, 6).map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between border-b border-ink-100/10 py-1.5 last:border-0"
              >
                <span className="truncate text-ink-50">{u.filename}</span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-widest ${
                    u.status === "done"
                      ? "text-accent"
                      : u.status === "error"
                        ? "text-rose"
                        : "text-plum"
                  }`}
                >
                  {u.status}
                </span>
              </li>
            ))}
            {!uploads.length && (
              <li className="text-ink-100/55">No uploads yet — drop a PDF above.</li>
            )}
          </ul>
        </div>
      </section>

      {/* Tasks */}
      <section className="mt-10">
        <h2 className="eyebrow mb-3">Agent tasks</h2>
        <div className="glass overflow-hidden rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-ink-950/50 font-mono uppercase tracking-widest text-ink-100/55">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">agent</th>
                <th className="px-4 py-2">status</th>
                <th className="px-4 py-2">summary</th>
              </tr>
            </thead>
            <tbody>
              {tasks.slice(0, 8).map((t) => (
                <tr key={t.id} className="border-t border-ink-100/10">
                  <td className="px-4 py-2 font-mono text-ink-100/55">#{t.id}</td>
                  <td className="px-4 py-2">{t.agent}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
                        t.status === "done"
                          ? "border-accent/60 text-accent"
                          : t.status === "error"
                            ? "border-rose/60 text-rose"
                            : "border-plum/60 text-plum"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-ink-100/75">
                    {typeof t.result?.summary === "string"
                      ? (t.result.summary as string)
                      : t.error ?? "—"}
                  </td>
                </tr>
              ))}
              {!tasks.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-ink-100/55">
                    No agent tasks yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Diffs */}
      <section className="mt-10 mb-16">
        <h2 className="eyebrow mb-3">
          Pending diffs · {diffs.filter((d) => d.status === "pending").length}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {diffs.map((d) => (
            <DiffCard key={d.id} diff={d} onApprove={approve} onReject={reject} />
          ))}
          {!diffs.length && (
            <p className="text-sm text-ink-100/55">
              No diffs yet. Upload a document and the Portfolio Manager Agent will populate this
              feed with structured suggestions.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function LoginCard({
  onSubmit,
  error,
}: {
  onSubmit: (token: string) => void;
  error: string | null;
}) {
  const [token, setToken] = useState("");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(token);
        }}
        className="glass-strong w-full max-w-sm rounded-3xl p-8"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-accent/80">
          // admin · sign in
        </p>
        <h1 className="mt-3 font-display text-3xl">Control room.</h1>
        <p className="mt-2 text-sm text-ink-100/70">
          Enter the admin token to manage uploads, agent tasks, and pending diffs.
        </p>
        <input
          autoFocus
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ADMIN_TOKEN"
          className="mt-6 w-full rounded-full border border-ink-100/15 bg-ink-950/50 px-4 py-2.5 text-sm text-ink-50 outline-none transition focus:border-accent/60"
        />
        {error && <p className="mt-2 text-xs text-rose">{error}</p>}
        <button
          type="submit"
          disabled={!token}
          className="mt-4 w-full rounded-full bg-accent py-2.5 text-sm font-medium text-ink-950 transition hover:bg-accent-soft disabled:opacity-40"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}

function UploadCard({
  busy,
  onUpload,
}: {
  busy: boolean;
  onUpload: (file: File) => void;
}) {
  const [drag, setDrag] = useState(false);
  return (
    <label
      className={`glass relative flex h-48 cursor-pointer items-center justify-center rounded-2xl border-dashed transition ${
        drag ? "border-accent/80 bg-accent/5" : "border-ink-100/20"
      } ${busy ? "opacity-60" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onUpload(f);
      }}
    >
      <input
        type="file"
        accept="application/pdf"
        disabled={busy}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
        }}
      />
      <div className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent/80">
          drop PDF
        </p>
        <p className="mt-2 font-display text-2xl text-ink-50">Upload a document</p>
        <p className="mt-1 text-xs text-ink-100/55">
          {busy ? "Uploading…" : "Portfolio Manager Agent will extract structured diffs."}
        </p>
      </div>
    </label>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ContactStatusButton({
  contact,
  onChange,
}: {
  contact: AdminContact;
  onChange: (status: "new" | "read" | "archived") => void;
}) {
  const next: Record<AdminContact["status"], AdminContact["status"]> = {
    new: "read",
    read: "archived",
    archived: "new",
  };
  const tone =
    contact.status === "new"
      ? "border-accent/60 text-accent"
      : contact.status === "read"
        ? "border-plum/50 text-plum"
        : "border-ink-100/20 text-ink-100/55";
  return (
    <button
      type="button"
      onClick={() => onChange(next[contact.status])}
      title={`Click to mark as ${next[contact.status]}`}
      className={`rounded-full border px-2 py-px font-mono text-[11px] uppercase tracking-widest ${tone}`}
    >
      {contact.status}
    </button>
  );
}

function DiffCard({
  diff,
  onApprove,
  onReject,
}: {
  diff: AdminDiff;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  const tone =
    diff.status === "approved"
      ? "border-accent/50"
      : diff.status === "rejected"
        ? "border-rose/40 opacity-60"
        : "border-ink-100/15";
  return (
    <article className={`glass rounded-2xl border p-5 ${tone}`}>
      <div className="flex items-baseline justify-between">
        <span className="rounded-full border border-ink-100/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-accent/80">
          {diff.action} · {diff.target_table}
        </span>
        <span className="font-mono text-[10px] text-ink-100/55">
          conf {diff.confidence}%
        </span>
      </div>

      <pre className="mt-3 max-h-44 overflow-auto rounded-xl bg-ink-950/60 p-3 font-mono text-[11px] leading-snug text-ink-100/85">
        {JSON.stringify(diff.payload, null, 2)}
      </pre>

      {diff.evidence && (
        <p className="mt-2 text-xs italic text-ink-100/65">“{diff.evidence}”</p>
      )}

      {diff.status === "pending" ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onApprove(diff.id)}
            className="flex-1 rounded-full bg-accent py-2 text-xs font-medium text-ink-950 transition hover:bg-accent-soft"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => onReject(diff.id)}
            className="flex-1 rounded-full border border-ink-100/15 py-2 text-xs text-ink-100/80 transition hover:border-rose/60 hover:text-rose"
          >
            Reject
          </button>
        </div>
      ) : (
        <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-ink-100/55">
          {diff.status}
        </p>
      )}
    </article>
  );
}
