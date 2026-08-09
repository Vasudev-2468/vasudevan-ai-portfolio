"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { admin, type AdminAuditPage } from "@/lib/admin";

const PAGE_SIZES = [25, 50, 100, 200] as const;

function fmt(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function actionTone(action: string): string {
  if (action.startsWith("admin.login_fail")) return "border-rose/50 text-rose";
  if (action.endsWith(".delete")) return "border-rose/50 text-rose";
  if (action.startsWith("admin.")) return "border-plum/50 text-plum";
  if (action.endsWith(".create")) return "border-accent/50 text-accent";
  if (action.endsWith(".update")) return "border-accent/40 text-accent/90";
  if (action.startsWith("contact.")) return "border-accent/40 text-accent/90";
  return "border-ink-100/15 text-ink-100/70";
}

function detailsPreview(details: Record<string, unknown> | null | undefined): string {
  if (!details || Object.keys(details).length === 0) return "—";
  return Object.keys(details).join(", ");
}

export default function AuditLogPanel() {
  const [page, setPage] = useState<AdminAuditPage | null>(null);
  const [pageSize, setPageSize] = useState<number>(50);
  const [offset, setOffset] = useState(0);
  const [actionPrefix, setActionPrefix] = useState("");
  const [actor, setActor] = useState("");
  const [targetTable, setTargetTable] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await admin.audit({
        limit: pageSize,
        offset,
        actionPrefix: actionPrefix.trim() || undefined,
        actor: actor.trim() || undefined,
        targetTable: targetTable.trim() || undefined,
      });
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [pageSize, offset, actionPrefix, actor, targetTable]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Reset to first page whenever a filter or page size changes.
    setOffset(0);
  }, [pageSize, actionPrefix, actor, targetTable]);

  const total = page?.total ?? 0;
  // Defensive: guard against unexpected shapes (stale bundles or wire-shape
  // changes) — `entries.map` must never see a non-array.
  const entries = Array.isArray(page?.entries) ? page.entries : [];
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + entries.length, total);
  const hasPrev = offset > 0;
  const hasNext = offset + entries.length < total;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-ink-50">
          Audit log <span className="text-ink-100/55">· {total}</span>
        </h3>
        <div className="flex items-center gap-2 font-mono text-[11px] text-ink-100/55">
          <span>append-only · most recent first</span>
          <a
            href={admin.exportUrl("audit", "csv")}
            className="rounded-full border border-ink-100/15 px-2 py-0.5 uppercase tracking-widest hover:border-accent/60 hover:text-accent"
            title="Download full audit log as CSV"
          >
            CSV
          </a>
          <a
            href={admin.exportUrl("audit", "json")}
            className="rounded-full border border-ink-100/15 px-2 py-0.5 uppercase tracking-widest hover:border-accent/60 hover:text-accent"
            title="Download full audit log as JSON"
          >
            JSON
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={actionPrefix}
          onChange={(e) => setActionPrefix(e.target.value)}
          placeholder="action prefix (e.g. publication.)"
          className="w-56 rounded-full border border-ink-100/15 bg-white/70 px-3 py-1 text-xs text-ink-50 outline-none focus:border-accent/60"
        />
        <input
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          placeholder="actor (e.g. admin)"
          className="w-32 rounded-full border border-ink-100/15 bg-white/70 px-3 py-1 text-xs text-ink-50 outline-none focus:border-accent/60"
        />
        <input
          value={targetTable}
          onChange={(e) => setTargetTable(e.target.value)}
          placeholder="target table"
          className="w-32 rounded-full border border-ink-100/15 bg-white/70 px-3 py-1 text-xs text-ink-50 outline-none focus:border-accent/60"
        />
        {(actionPrefix || actor || targetTable) && (
          <button
            type="button"
            onClick={() => {
              setActionPrefix("");
              setActor("");
              setTargetTable("");
            }}
            className="rounded-full border border-ink-100/15 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-100/70 hover:border-rose/40 hover:text-rose"
          >
            clear
          </button>
        )}
        <span className="ml-auto flex items-center gap-2 font-mono text-[11px] text-ink-100/55">
          rows
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-full border border-ink-100/15 bg-white/70 px-2 py-0.5 text-xs text-ink-50 outline-none focus:border-accent/60"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </span>
      </div>

      {loading && entries.length === 0 ? (
        <p className="text-sm text-ink-100/55">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-ink-100/55">No audit entries match.</p>
      ) : (
        <div className="max-h-[480px] overflow-auto rounded-xl border border-ink-100/10">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-ink-950/70 font-mono uppercase tracking-widest text-ink-100/55 backdrop-blur">
              <tr>
                <th className="px-3 py-2 font-normal">Time</th>
                <th className="px-3 py-2 font-normal">Action</th>
                <th className="px-3 py-2 font-normal">Actor</th>
                <th className="px-3 py-2 font-normal">Target</th>
                <th className="px-3 py-2 font-normal">IP</th>
                <th className="px-3 py-2 font-normal">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((a) => {
                const hasDetails = a.details && Object.keys(a.details).length > 0;
                const isOpen = openId === a.id;
                return (
                  <Fragment key={a.id}>
                    <tr
                      className={`border-t border-ink-100/10 align-top ${
                        hasDetails ? "cursor-pointer hover:bg-white/40" : ""
                      }`}
                      onClick={() => hasDetails && setOpenId(isOpen ? null : a.id)}
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-ink-100/75">
                        {fmt(a.created_at)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${actionTone(a.action)}`}
                        >
                          {a.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-ink-100/85">{a.actor}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-ink-100/75">
                        {a.target_table ? `${a.target_table}#${a.target_id ?? "—"}` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-ink-100/55">
                        {a.ip ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-ink-100/75">
                        {hasDetails ? (
                          <span className="inline-flex items-center gap-1 text-accent/90">
                            <span aria-hidden>{isOpen ? "▾" : "▸"}</span>
                            {detailsPreview(a.details)}
                          </span>
                        ) : (
                          <span className="text-ink-100/45">—</span>
                        )}
                      </td>
                    </tr>
                    {isOpen && hasDetails && (
                      <tr className="border-t border-ink-100/5 bg-white/40">
                        <td colSpan={6} className="px-3 py-2">
                          <pre className="max-h-64 overflow-auto rounded-md bg-white/70 px-3 py-2 font-mono text-[11px] leading-snug text-ink-100/85">
                            {JSON.stringify(a.details, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination footer */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="font-mono text-[11px] text-ink-100/55">
          {total === 0
            ? "no entries"
            : `showing ${from}–${to} of ${total}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => setOffset(Math.max(0, offset - pageSize))}
            className="rounded-full border border-ink-100/15 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-100/75 transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← prev
          </button>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => setOffset(offset + pageSize)}
            className="rounded-full border border-ink-100/15 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-100/75 transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            next →
          </button>
        </div>
      </div>
    </div>
  );
}
