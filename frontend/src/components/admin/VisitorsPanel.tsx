"use client";

import type { AdminVisitor } from "@/lib/admin";

function fmt(iso: string): string {
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

export default function VisitorsPanel({ visitors }: { visitors: AdminVisitor[] }) {
  const identified = visitors.filter((v) => v.email).length;
  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-ink-50">
          Visitors <span className="text-ink-100/55">· {visitors.length}</span>
        </h3>
        <span className="font-mono text-[11px] text-ink-100/55">
          {identified} identified · {visitors.length - identified} anonymous
        </span>
      </div>
      {visitors.length === 0 ? (
        <p className="text-sm text-ink-100/55">No visitor sessions yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="font-mono uppercase tracking-widest text-ink-100/55">
              <tr>
                <th className="py-2 pr-3">Email / Session</th>
                <th className="py-2 pr-3">IP</th>
                <th className="py-2 pr-3 text-right">Views</th>
                <th className="py-2 pr-3 text-right">DLs</th>
                <th className="py-2 pr-3 text-right">Msgs</th>
                <th className="py-2 pr-3">First seen</th>
                <th className="py-2">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map((v) => (
                <tr key={v.id} className="border-t border-ink-100/10">
                  <td className="py-2 pr-3">
                    {v.email ? (
                      <div>
                        <div className="font-medium text-ink-50">{v.email}</div>
                        {v.name && (
                          <div className="text-ink-100/65">{v.name}</div>
                        )}
                        <div className="font-mono text-[11px] text-ink-100/45">
                          sid {v.session_id.slice(-8)}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="italic text-ink-100/55">anonymous</div>
                        <div className="font-mono text-[11px] text-ink-100/45">
                          sid {v.session_id.slice(-8)}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-3 font-mono text-[11px] text-ink-100/65">{v.ip ?? "-"}</td>
                  <td className="py-2 pr-3 text-right font-mono">{v.views}</td>
                  <td className="py-2 pr-3 text-right font-mono">{v.downloads}</td>
                  <td className="py-2 pr-3 text-right font-mono">{v.messages}</td>
                  <td className="py-2 pr-3 font-mono text-[11px] text-ink-100/65">{fmt(v.first_seen)}</td>
                  <td className="py-2 font-mono text-[11px] text-ink-100/65">{fmt(v.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
