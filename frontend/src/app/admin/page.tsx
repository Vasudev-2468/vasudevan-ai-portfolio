"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AccountPanel from "@/components/admin/AccountPanel";
import AuditLogPanel from "@/components/admin/AuditLogPanel";
import ContentPanels from "@/components/admin/ContentPanels";
import CustomFieldsPanel from "@/components/admin/CustomFieldsPanel";
import DailyChart from "@/components/admin/DailyChart";
import VisitorsPanel from "@/components/admin/VisitorsPanel";
import {
  admin,
  auth,
  UnauthorizedError,
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
  type AuthedUserInfo,
} from "@/lib/admin";

type ViewTab = "content" | "dashboard";
type DiffFilter = "pending" | "approved" | "rejected" | "all";
type ChartRange = 7 | 30 | 60 | 90;

export default function AdminPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl px-6 py-12 md:px-10" />}>
      <AdminPageInner />
    </Suspense>
  );
}

function AdminPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialView: ViewTab = searchParams.get("view") === "dashboard" ? "dashboard" : "content";

  const [view, setView] = useState<ViewTab>(initialView);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [diffs, setDiffs] = useState<AdminDiff[]>([]);
  const [diffFilter, setDiffFilter] = useState<DiffFilter>("pending");
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [uploads, setUploads] = useState<AdminUpload[]>([]);
  const [contacts, setContacts] = useState<AdminContact[]>([]);
  const [contactQuery, setContactQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
  const [views, setViews] = useState<AdminView[]>([]);
  const [viewQuery, setViewQuery] = useState("");
  const [viewStats, setViewStats] = useState<AdminViewStats | null>(null);
  const [downloads, setDownloads] = useState<AdminDownload[]>([]);
  const [downloadQuery, setDownloadQuery] = useState("");
  const [chartRange, setChartRange] = useState<ChartRange>(30);
  const [daily, setDaily] = useState<AdminDailyAnalytics | null>(null);
  const [visitors, setVisitors] = useState<AdminVisitor[]>([]);
  const [customFields, setCustomFields] = useState<AdminCustomField[]>([]);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; msg: string } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [showAllUploads, setShowAllUploads] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [me, setMe] = useState<AuthedUserInfo | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const inFlight = useRef(false);

  // Auth gate: check session on mount. 401 → login. needs_setup → setup.
  const loadMe = useCallback(async () => {
    try {
      const info = await auth.me();
      setMe(info);
      setAuthReady(true);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        const status = await auth.status().catch(() => ({ needs_setup: false }));
        router.replace(status.needs_setup ? "/admin/setup" : "/admin/login");
      } else {
        setAuthReady(true); // let the error banner show
      }
    }
  }, [router]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  // Sync ?view= param without pushing history entries. Only depends on
  // `view` — re-including `searchParams` would re-fire after every replace.
  useEffect(() => {
    const target = view === "dashboard" ? "/admin?view=dashboard" : "/admin";
    router.replace(target, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    inFlight.current = true;
    try {
      const diffStatusArg = diffFilter === "all" ? undefined : diffFilter;
      const [s, d, t, u, c, v, vs, dl, da, vis, cf] = await Promise.all([
        admin.stats(),
        admin.diffs(diffStatusArg),
        admin.tasks(),
        admin.uploads(),
        admin.contacts(),
        admin.views(50),
        admin.viewStats(),
        admin.downloads(50),
        admin.dailyAnalytics(chartRange),
        admin.visitors(100),
        admin.customFields(),
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
      setFetchError(null);
      setLoadedOnce(true);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        router.replace("/admin/login");
        return;
      }
      setFetchError((e as Error).message || "failed to load admin data");
    } finally {
      inFlight.current = false;
    }
  }, [chartRange, diffFilter, router]);

  useEffect(() => {
    if (!me) return; // wait for auth gate to finish before polling
    refresh();
    const id = setInterval(refresh, 8000);
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh, me]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 5000);
    return () => clearTimeout(id);
  }, [flash]);

  async function handleUpload(file: File) {
    setBusy(true);
    try {
      const res = await admin.upload(file);
      setFlash({ tone: "ok", msg: `Queued · upload #${res.upload_id} → task #${res.task_id}` });
      await refresh();
    } catch (e) {
      setFlash({ tone: "err", msg: `Upload failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  async function approve(id: number) {
    try {
      await admin.approve(id);
      setFlash({ tone: "ok", msg: `Approved diff #${id} — applied to portfolio.` });
      await refresh();
    } catch (e) {
      setFlash({ tone: "err", msg: `Approve failed: ${(e as Error).message}` });
    }
  }

  async function reject(id: number) {
    if (!window.confirm(`Reject diff #${id}? This cannot be undone.`)) return;
    try {
      await admin.reject(id);
      setFlash({ tone: "ok", msg: `Rejected diff #${id}.` });
      await refresh();
    } catch (e) {
      setFlash({ tone: "err", msg: `Reject failed: ${(e as Error).message}` });
    }
  }

  async function approveAllPending() {
    const pending = diffs.filter((d) => d.status === "pending");
    if (pending.length === 0) return;
    if (!window.confirm(`Approve all ${pending.length} pending diffs?`)) return;
    setBusy(true);
    let ok = 0;
    let failed = 0;
    for (const d of pending) {
      try {
        await admin.approve(d.id);
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    setBusy(false);
    setFlash({
      tone: failed ? "err" : "ok",
      msg: `Bulk approve: ${ok} applied${failed ? `, ${failed} failed` : ""}.`,
    });
    await refresh();
  }

  async function reindex() {
    if (!window.confirm("Rebuild the vector index? This clears and re-embeds all portfolio chunks.")) return;
    setBusy(true);
    try {
      const res = await admin.reindex();
      setFlash({ tone: "ok", msg: `Reindexed ${res.chunks_indexed} chunks.` });
      await refresh();
    } catch (e) {
      setFlash({ tone: "err", msg: `Reindex failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  async function bulkArchiveContacts() {
    const ids = Array.from(selectedContacts);
    if (ids.length === 0) return;
    if (!window.confirm(`Archive ${ids.length} contact${ids.length === 1 ? "" : "s"}?`)) return;
    setBusy(true);
    let ok = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await admin.setContactStatus(id, "archived");
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    setBusy(false);
    setSelectedContacts(new Set());
    setFlash({
      tone: failed ? "err" : "ok",
      msg: `Archived ${ok}${failed ? `, ${failed} failed` : ""}.`,
    });
    await refresh();
  }

  const filteredContacts = useMemo(() => {
    const q = contactQuery.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      `${c.name} ${c.email} ${c.subject ?? ""} ${c.message}`.toLowerCase().includes(q),
    );
  }, [contacts, contactQuery]);

  const filteredViews = useMemo(() => {
    const q = viewQuery.trim().toLowerCase();
    if (!q) return views;
    return views.filter((v) =>
      `${v.path} ${v.ip ?? ""} ${v.session_id ?? ""}`.toLowerCase().includes(q),
    );
  }, [views, viewQuery]);

  const filteredDownloads = useMemo(() => {
    const q = downloadQuery.trim().toLowerCase();
    if (!q) return downloads;
    return downloads.filter((d) =>
      `${d.resource} ${d.path ?? ""} ${d.ip ?? ""} ${d.session_id ?? ""}`.toLowerCase().includes(q),
    );
  }, [downloads, downloadQuery]);

  const openTask = useMemo(
    () => (openTaskId === null ? null : tasks.find((t) => t.id === openTaskId) ?? null),
    [openTaskId, tasks],
  );

  if (!authReady || !me) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-xs text-ink-100/55">
          {authReady ? "signing you in…" : "checking session…"}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:px-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-accent/80">
            // admin · portfolio manager · {me.email}
          </p>
          <h1 className="mt-2 font-display text-display-lg leading-[0.95]">
            Control room.
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <EnvBadge />
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="glass rounded-full px-4 py-2 transition hover:border-accent/60"
            title="Open the public site in a new tab"
          >
            View site ↗
          </a>
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
            onClick={async () => {
              try {
                await auth.logout();
              } catch {
                /* still redirect below */
              }
              router.replace("/admin/login");
            }}
            className="rounded-full border border-rose/40 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-rose transition hover:bg-rose/10"
          >
            Sign out
          </button>
        </div>
      </header>

      {!me.totp_enabled && (
        <div
          role="alert"
          className="glass mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border-rose/40 px-4 py-3 font-mono text-xs text-rose"
        >
          <span>
            ⚠ Two-factor auth is <strong>off</strong>. Anyone with just your password can sign in.
          </span>
          <button
            type="button"
            onClick={() => setView("dashboard")}
            className="rounded-full border border-rose/40 px-3 py-1 uppercase tracking-widest hover:bg-rose/10"
          >
            Enable 2FA →
          </button>
        </div>
      )}

      {fetchError && (
        <div
          role="alert"
          className="glass mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border-rose/40 px-4 py-3 font-mono text-xs text-rose"
        >
          <span>⚠ {fetchError}</span>
          <button
            type="button"
            onClick={refresh}
            className="rounded-full border border-rose/40 px-3 py-1 uppercase tracking-widest hover:bg-rose/10"
          >
            Retry
          </button>
        </div>
      )}

      {flash && (
        <div
          role="status"
          className={`glass mb-6 rounded-xl px-4 py-3 font-mono text-xs ${
            flash.tone === "err" ? "border-rose/40 text-rose" : "border-accent/30 text-accent"
          }`}
        >
          {flash.msg}
        </div>
      )}

      {/* View switcher — dashboard tab shows a pending-review badge when the
          Portfolio Manager Agent has diffs waiting for approval, so admins
          notice work without having to leave the Content tab. */}
      <div className="mb-8 inline-flex rounded-full border border-ink-100/15 bg-ink-950/40 p-1">
        {(["content", "dashboard"] as const).map((v) => {
          const pending = v === "dashboard" ? stats?.pending_review ?? 0 : 0;
          return (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`relative inline-flex items-center gap-1.5 rounded-full px-5 py-1.5 font-mono text-[11px] uppercase tracking-widest transition ${
                view === v ? "bg-accent text-ink-950" : "text-ink-100/75 hover:text-accent"
              }`}
            >
              {v}
              {pending > 0 && (
                <span
                  className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none ${
                    view === v ? "bg-ink-950/80 text-accent" : "bg-accent text-ink-950"
                  }`}
                  aria-label={`${pending} pending diffs`}
                >
                  {pending}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {view === "content" ? (
        <ContentPanels />
      ) : (
        <>
          {/* Stats */}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {!loadedOnce && !stats
              ? Array.from({ length: 8 }).map((_, i) => <StatSkeleton key={i} />)
              : stats &&
                (
                  [
                    ["Pending review", stats.pending_review, "accent"],
                    ["Vector chunks", stats.vector_chunks, "plum"],
                    ["Uploads", stats.uploads, "ink"],
                    ["Publications", stats.publications, "ink"],
                    ["Contacts", stats.contacts, "ink"],
                    ["Page views", stats.page_views, "ink"],
                    ["Downloads", stats.downloads, "ink"],
                    ["Agent tasks", stats.agent_tasks, "ink"],
                  ] as const
                ).map(([label, value, tone]) => (
                  <div key={label} className="glass rounded-2xl p-5">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-ink-100/55">
                      {label}
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
                      {value}
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

            <div className="glass rounded-2xl p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-medium text-ink-50">
                  Daily activity{" "}
                  <span className="text-ink-100/55">
                    · last {daily?.days ?? chartRange} days
                  </span>
                </h3>
                <div className="inline-flex rounded-full border border-ink-100/15 p-0.5">
                  {([7, 30, 60, 90] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setChartRange(n)}
                      className={`rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-widest transition ${
                        chartRange === n ? "bg-accent text-ink-950" : "text-ink-100/70 hover:text-accent"
                      }`}
                      aria-pressed={chartRange === n}
                    >
                      {n}d
                    </button>
                  ))}
                </div>
              </div>
              {daily ? (
                <DailyChart series={daily.series} />
              ) : (
                <div className="h-32 animate-pulse rounded-xl bg-ink-950/30" />
              )}
            </div>

            <AccountPanel user={me} onUserChanged={loadMe} />
            <VisitorsPanel visitors={visitors} />
            <CustomFieldsPanel fields={customFields} onChanged={refresh} />
            <AuditLogPanel />

            {/* Contact messages */}
            <div className="glass rounded-2xl p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-medium text-ink-50">
                  Contact messages{" "}
                  <span className="text-ink-100/55">
                    · {contactQuery ? `${filteredContacts.length} of ` : ""}
                    {contacts.length}
                  </span>
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    value={contactQuery}
                    onChange={(e) => setContactQuery(e.target.value)}
                    placeholder="filter…"
                    className="w-44 rounded-full border border-ink-100/15 bg-white/70 px-3 py-1 text-xs text-ink-50 outline-none focus:border-accent/60"
                    aria-label="filter contacts"
                  />
                  {selectedContacts.size > 0 && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={bulkArchiveContacts}
                      className="rounded-full border border-plum/50 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-plum transition hover:bg-plum/10 disabled:opacity-40"
                    >
                      Archive {selectedContacts.size}
                    </button>
                  )}
                  <a
                    href={admin.exportUrl("contacts", "csv")}
                    className="rounded-full border border-ink-100/15 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-ink-100/75 transition hover:border-accent/60 hover:text-accent"
                    title="Download contacts as CSV"
                  >
                    CSV
                  </a>
                  <button
                    type="button"
                    disabled={filteredContacts.length === 0}
                    onClick={() =>
                      downloadCsv(
                        "contacts.csv",
                        ["id", "created_at", "name", "email", "subject", "status", "ip", "message"],
                        filteredContacts.map((c) => [
                          c.id,
                          c.created_at,
                          c.name,
                          c.email,
                          c.subject ?? "",
                          c.status,
                          c.ip ?? "",
                          c.message,
                        ]),
                      )
                    }
                    className="rounded-full border border-ink-100/15 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-ink-100/75 transition hover:border-accent/40 hover:text-accent disabled:opacity-40"
                  >
                    Export CSV
                  </button>
                </div>
              </div>
              {filteredContacts.length === 0 ? (
                <p className="text-sm text-ink-100/55">
                  {contacts.length === 0 ? "No contact messages yet." : "No matches."}
                </p>
              ) : (
                <ul className="divide-y divide-ink-100/10">
                  {filteredContacts.map((c) => (
                    <li key={c.id} className="py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-2">
                          <input
                            type="checkbox"
                            checked={selectedContacts.has(c.id)}
                            onChange={(e) => {
                              const next = new Set(selectedContacts);
                              if (e.target.checked) next.add(c.id);
                              else next.delete(c.id);
                              setSelectedContacts(next);
                            }}
                            aria-label={`select ${c.name}`}
                            className="translate-y-px"
                          />
                          <span className="text-sm font-medium text-ink-50">
                            {c.name}{" "}
                            <a
                              href={`mailto:${c.email}${c.subject ? `?subject=Re: ${encodeURIComponent(c.subject)}` : ""}`}
                              className="font-mono text-xs text-ink-100/55 hover:text-accent"
                            >
                              &lt;{c.email}&gt;
                            </a>
                          </span>
                        </div>
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
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-medium text-ink-50">Page views</h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="search"
                      value={viewQuery}
                      onChange={(e) => setViewQuery(e.target.value)}
                      placeholder="filter…"
                      className="w-32 rounded-full border border-ink-100/15 bg-white/70 px-3 py-1 text-xs text-ink-50 outline-none focus:border-accent/60"
                      aria-label="filter page views"
                    />
                    <button
                      type="button"
                      disabled={filteredViews.length === 0}
                      onClick={() =>
                        downloadCsv(
                          "page_views.csv",
                          ["id", "created_at", "path", "referrer", "ip", "session_id"],
                          filteredViews.map((v) => [
                            v.id,
                            v.created_at,
                            v.path,
                            v.referrer ?? "",
                            v.ip ?? "",
                            v.session_id ?? "",
                          ]),
                        )
                      }
                      className="rounded-full border border-ink-100/15 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-100/70 transition hover:border-accent/40 hover:text-accent disabled:opacity-40"
                    >
                      CSV
                    </button>
                  </div>
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
                  {filteredViews.map((v) => (
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
                  {filteredViews.length === 0 && (
                    <li className="py-2 text-xs text-ink-100/55">
                      {views.length === 0 ? "No page views yet." : "No matches."}
                    </li>
                  )}
                </ul>
              </div>

              <div className="glass rounded-2xl p-5">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-medium text-ink-50">Downloads</h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="search"
                      value={downloadQuery}
                      onChange={(e) => setDownloadQuery(e.target.value)}
                      placeholder="filter…"
                      className="w-32 rounded-full border border-ink-100/15 bg-white/70 px-3 py-1 text-xs text-ink-50 outline-none focus:border-accent/60"
                      aria-label="filter downloads"
                    />
                    <button
                      type="button"
                      disabled={filteredDownloads.length === 0}
                      onClick={() =>
                        downloadCsv(
                          "downloads.csv",
                          ["id", "created_at", "resource", "path", "ip", "session_id"],
                          filteredDownloads.map((d) => [
                            d.id,
                            d.created_at,
                            d.resource,
                            d.path ?? "",
                            d.ip ?? "",
                            d.session_id ?? "",
                          ]),
                        )
                      }
                      className="rounded-full border border-ink-100/15 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-100/70 transition hover:border-accent/40 hover:text-accent disabled:opacity-40"
                    >
                      CSV
                    </button>
                  </div>
                </div>
                <ul className="max-h-64 divide-y divide-ink-100/10 overflow-y-auto">
                  {filteredDownloads.map((d) => (
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
                  {filteredDownloads.length === 0 && (
                    <li className="py-2 text-xs text-ink-100/55">
                      {downloads.length === 0 ? "No downloads yet." : "No matches."}
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </section>

          {/* Upload */}
          <section className="mt-10 grid gap-6 md:grid-cols-2">
            <UploadCard busy={busy} onUpload={handleUpload} />

            <div className="glass rounded-2xl p-6">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="eyebrow">Recent uploads</h2>
                {uploads.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAllUploads((x) => !x)}
                    className="font-mono text-[11px] uppercase tracking-widest text-accent/80 hover:text-accent"
                  >
                    {showAllUploads ? "Show less" : `Show all (${uploads.length})`}
                  </button>
                )}
              </div>
              <ul className="space-y-2 text-xs">
                {(showAllUploads ? uploads : uploads.slice(0, 6)).map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between border-b border-ink-100/10 py-1.5 last:border-0"
                  >
                    <span className="truncate text-ink-50">{u.filename}</span>
                    <StatusBadge status={u.status} />
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
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="eyebrow">Agent tasks</h2>
              {tasks.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAllTasks((x) => !x)}
                  className="font-mono text-[11px] uppercase tracking-widest text-accent/80 hover:text-accent"
                >
                  {showAllTasks ? "Show less" : `Show all (${tasks.length})`}
                </button>
              )}
            </div>
            <div className="glass overflow-hidden rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-ink-950/50 font-mono uppercase tracking-widest text-ink-100/55">
                  <tr>
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">agent</th>
                    <th className="px-4 py-2">status</th>
                    <th className="px-4 py-2">summary</th>
                    <th className="px-4 py-2 text-right">details</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllTasks ? tasks : tasks.slice(0, 8)).map((t) => (
                    <tr key={t.id} className="border-t border-ink-100/10">
                      <td className="px-4 py-2 font-mono text-ink-100/55">#{t.id}</td>
                      <td className="px-4 py-2">{t.agent}</td>
                      <td className="px-4 py-2">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-2 text-ink-100/75">
                        {typeof t.result?.summary === "string"
                          ? (t.result.summary as string)
                          : t.error ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setOpenTaskId(t.id)}
                          className="font-mono text-[11px] uppercase tracking-widest text-accent/80 hover:text-accent"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!tasks.length && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-ink-100/55">
                        No agent tasks yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {openTask && <TaskDetailModal task={openTask} onClose={() => setOpenTaskId(null)} />}

          {/* Diffs */}
          <section className="mb-16 mt-10">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="eyebrow">
                Diffs · {diffs.length}
                {diffFilter !== "all" && (
                  <span className="ml-2 font-mono text-[11px] normal-case text-ink-100/55">
                    ({diffFilter})
                  </span>
                )}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-full border border-ink-100/15 p-0.5">
                  {(["pending", "approved", "rejected", "all"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setDiffFilter(f)}
                      className={`rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-widest transition ${
                        diffFilter === f
                          ? "bg-accent text-ink-950"
                          : "text-ink-100/70 hover:text-accent"
                      }`}
                      aria-pressed={diffFilter === f}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                {diffFilter === "pending" && diffs.length > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={approveAllPending}
                    className="rounded-full border border-accent/50 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-accent transition hover:bg-accent/10 disabled:opacity-40"
                  >
                    Approve all
                  </button>
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {diffs.map((d) => (
                <DiffCard key={d.id} diff={d} onApprove={approve} onReject={reject} />
              ))}
              {!diffs.length && (
                <p className="text-sm text-ink-100/55">
                  {diffFilter === "pending"
                    ? "No pending diffs. Upload a document and the Portfolio Manager Agent will populate this feed with structured suggestions."
                    : `No ${diffFilter} diffs.`}
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function StatSkeleton() {
  return (
    <div className="glass animate-pulse rounded-2xl p-5">
      <div className="h-2 w-16 rounded-full bg-ink-100/10" />
      <div className="mt-3 h-8 w-12 rounded-md bg-ink-100/10" />
    </div>
  );
}

function EnvBadge() {
  const env =
    typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "local"
      : process.env.NEXT_PUBLIC_ENV ?? "prod";
  const tone =
    env === "local"
      ? "border-plum/50 text-plum"
      : env === "prod"
        ? "border-accent/50 text-accent"
        : "border-ink-100/20 text-ink-100/70";
  return (
    <span
      className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${tone}`}
    >
      env · {env}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "done"
      ? "border-accent/60 text-accent"
      : status === "error"
        ? "border-rose/60 text-rose"
        : "border-plum/60 text-plum";
  const icon =
    status === "done" ? "✓" : status === "error" ? "!" : status === "queued" ? "…" : "◐";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${tone}`}
      aria-label={`status ${status}`}
    >
      <span aria-hidden>{icon}</span>
      {status}
    </span>
  );
}

function TaskDetailModal({ task, onClose }: { task: AdminTask; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`agent task ${task.id}`}
      onClick={onClose}
    >
      <div
        className="glass max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between border-b border-ink-100/10 px-5 py-3">
          <h3 className="text-sm font-medium text-ink-50">
            Task #{task.id} <span className="text-ink-100/55">· {task.agent}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-ink-100/20 px-3 py-1 font-mono text-[11px] uppercase text-ink-100/70 hover:border-rose/50 hover:text-rose"
            aria-label="close"
          >
            Close
          </button>
        </div>
        <div className="max-h-[60vh] overflow-auto p-5 text-xs">
          <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
            <dt className="text-ink-100/55">status</dt>
            <dd>
              <StatusBadge status={task.status} />
            </dd>
            <dt className="text-ink-100/55">created</dt>
            <dd>{formatDate(task.created_at)}</dd>
            <dt className="text-ink-100/55">finished</dt>
            <dd>{task.finished_at ? formatDate(task.finished_at) : "—"}</dd>
            {task.upload_id !== null && (
              <>
                <dt className="text-ink-100/55">upload</dt>
                <dd>#{task.upload_id}</dd>
              </>
            )}
          </dl>
          {task.error && (
            <div className="mb-3 rounded-md border border-rose/40 bg-rose/5 p-2 font-mono text-[11px] text-rose">
              {task.error}
            </div>
          )}
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-ink-100/55">
            result
          </p>
          <pre className="max-h-[40vh] overflow-auto rounded-md bg-ink-950/60 p-3 font-mono text-[11px] leading-snug text-ink-100/85">
            {JSON.stringify(task.result, null, 2)}
          </pre>
        </div>
      </div>
    </div>
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
      aria-label="upload a PDF document"
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
        aria-label="pdf file"
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
  const tone =
    contact.status === "new"
      ? "border-accent/60 text-accent"
      : contact.status === "read"
        ? "border-plum/50 text-plum"
        : "border-ink-100/20 text-ink-100/55";
  return (
    <select
      value={contact.status}
      onChange={(e) => onChange(e.target.value as AdminContact["status"])}
      className={`cursor-pointer rounded-full border bg-transparent px-2 py-px font-mono text-[11px] uppercase tracking-widest outline-none focus:border-accent ${tone}`}
      aria-label="contact status"
    >
      <option value="new">new</option>
      <option value="read">read</option>
      <option value="archived">archived</option>
    </select>
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
  const entries = Object.entries(diff.payload ?? {});
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

      {entries.length === 0 ? (
        <p className="mt-3 text-xs italic text-ink-100/55">Empty payload.</p>
      ) : (
        <dl className="mt-3 max-h-44 overflow-auto rounded-xl bg-ink-950/60 p-3 text-[11px]">
          {entries.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[auto_1fr] gap-x-3 py-0.5">
              <dt className="font-mono text-accent/80">{k}</dt>
              <dd className="whitespace-pre-wrap break-words font-mono text-ink-100/85">
                {formatDiffValue(v)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {diff.evidence && (
        <p className="mt-2 text-xs italic text-ink-100/65">&ldquo;{diff.evidence}&rdquo;</p>
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

function formatDiffValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v))
    return v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(", ");
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
