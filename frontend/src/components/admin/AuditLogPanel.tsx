"use client";

import type { AdminAuditEntry } from "@/lib/admin";

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
  if (action.startsWith("admin.")) return "border-plum/50 text-plum";
  if (action.startsWith("custom_field.delete")) return "border-rose/50 text-rose";
  if (action.startsWith("custom_field.")) return "border-accent/50 text-accent";
  if (action.startsWith("contact.")) return "border-accent/40 text-accent/90";
  return "border-ink-100/15 text-ink-100/70";
}

export default function AuditLogPanel({ entries }: { entries: AdminAuditEntry[] }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-ink-50">
          Audit log <span className="text-ink-100/55">· {entries.length}</span>
        </h3>
        <span className="font-mono text-[11px] text-ink-100/55">
          append-only · most recent first
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-ink-100/55">No audit entries yet.</p>
      ) : (
        <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {entries.map((a) => (
            <li key={a.id} className="border-b border-ink-100/10 pb-2 last:border-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest ${actionTone(a.action)}`}
                >
                  {a.action}
                </span>
                <span className="font-mono text-[11px] text-ink-100/55">
                  {fmt(a.created_at)} · {a.ip ?? "-"}
                </span>
              </div>
              <div className="mt-1 text-xs text-ink-100/75">
                <span className="font-mono text-ink-100/55">actor:</span> {a.actor}
                {a.target_table && (
                  <>
                    {" · "}
                    <span className="font-mono text-ink-100/55">target:</span>{" "}
                    {a.target_table}#{a.target_id ?? "—"}
                  </>
                )}
              </div>
              {Object.keys(a.details ?? {}).length > 0 && (
                <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-white/60 px-2 py-1 font-mono text-[11px] leading-snug text-ink-100/85">
                  {JSON.stringify(a.details, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
