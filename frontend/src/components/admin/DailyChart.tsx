"use client";

import type { AdminDailyPoint } from "@/lib/admin";

const W = 720;
const H = 180;
const PAD = { l: 28, r: 12, t: 14, b: 22 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;

const COLORS = {
  views: "#8b1ec8",
  contacts: "#c8729a",
  downloads: "#5a1480",
};

function fmtDay(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function DailyChart({ series }: { series: AdminDailyPoint[] }) {
  if (series.length === 0) {
    return (
      <p className="text-sm text-ink-100/55">No activity yet — the chart fills in as people visit.</p>
    );
  }

  const maxValue = Math.max(
    1,
    ...series.map((d) => Math.max(d.views, d.contacts, d.downloads)),
  );
  const niceMax = niceCeil(maxValue);
  const groupW = PLOT_W / series.length;
  const barW = Math.max(2, (groupW - 4) / 3);

  const totals = series.reduce(
    (acc, d) => ({
      views: acc.views + d.views,
      contacts: acc.contacts + d.contacts,
      downloads: acc.downloads + d.downloads,
    }),
    { views: 0, contacts: 0, downloads: 0 },
  );

  const gridLines = [0, 0.5, 1].map((t) => {
    const y = PAD.t + PLOT_H - t * PLOT_H;
    const label = Math.round(t * niceMax);
    return { y, label };
  });

  // Tick label every Nth day so they don't overlap
  const labelEvery = Math.max(1, Math.ceil(series.length / 10));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs">
        <Legend color={COLORS.views} label="views" value={totals.views} />
        <Legend color={COLORS.contacts} label="contacts" value={totals.contacts} />
        <Legend color={COLORS.downloads} label="downloads" value={totals.downloads} />
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Daily activity chart"
        className="w-full"
      >
        {/* Grid */}
        {gridLines.map((g) => (
          <g key={g.label}>
            <line x1={PAD.l} y1={g.y} x2={W - PAD.r} y2={g.y} stroke="rgb(0 0 0 / 0.08)" />
            <text x={PAD.l - 6} y={g.y + 3} textAnchor="end" fontSize="10" fill="rgb(0 0 0 / 0.5)">
              {g.label}
            </text>
          </g>
        ))}

        {/* Bars */}
        {series.map((d, i) => {
          const cx = PAD.l + i * groupW + groupW / 2;
          const baseLeft = cx - (barW * 3) / 2 - 2;
          return (
            <g key={d.date}>
              {([
                ["views", d.views, COLORS.views],
                ["contacts", d.contacts, COLORS.contacts],
                ["downloads", d.downloads, COLORS.downloads],
              ] as const).map(([key, value, color], j) => {
                const h = (value / niceMax) * PLOT_H;
                const x = baseLeft + j * (barW + 1);
                const y = PAD.t + PLOT_H - h;
                return (
                  <rect
                    key={key}
                    x={x}
                    y={y}
                    width={barW}
                    height={h}
                    fill={color}
                    opacity={value === 0 ? 0.15 : 0.9}
                  >
                    <title>
                      {fmtDay(d.date)} · {key} {value}
                    </title>
                  </rect>
                );
              })}
              {i % labelEvery === 0 && (
                <text
                  x={cx}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize="9"
                  fill="rgb(0 0 0 / 0.5)"
                >
                  {fmtDay(d.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-sm"
        style={{ background: color }}
      />
      <span className="text-ink-100/70">{label}</span>
      <span className="font-mono text-ink-50">{value}</span>
    </span>
  );
}

function niceCeil(n: number): number {
  if (n <= 5) return 5;
  if (n <= 10) return 10;
  if (n <= 20) return 20;
  if (n <= 50) return 50;
  if (n <= 100) return 100;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  return Math.ceil(n / pow) * pow;
}
