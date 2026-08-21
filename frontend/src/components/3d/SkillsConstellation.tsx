"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { Skill } from "@/lib/api";

/**
 * SkillsConstellation
 *
 * A category-oriented "constellation" — each category is a sub-network of
 * connected nodes. It uses SVG + CSS transforms so it stays crisp, animates
 * cheaply, and behaves well on mobile. Not a WebGL layer — this section
 * benefits from clarity more than 3D volume.
 */

const CATEGORY_COLORS = [
  { fill: "#7dd3ff", label: "cyan" },
  { fill: "#a894ff", label: "plum" },
  { fill: "#ff9ec7", label: "rose" },
  { fill: "#9be7c4", label: "mint" },
  { fill: "#f6c96e", label: "amber" },
  { fill: "#8ab4ff", label: "steel" },
];

export default function SkillsConstellation({ items }: { items: Skill[] }) {
  const grouped = useMemo(() => {
    return items.reduce<Record<string, Skill[]>>((acc, s) => {
      (acc[s.category] ??= []).push(s);
      return acc;
    }, {});
  }, [items]);

  const categories = Object.entries(grouped);
  const [hovered, setHovered] = useState<Skill | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      {/* Left: constellation canvases per category */}
      <div className="grid gap-6 sm:grid-cols-2">
        {categories.map(([cat, list], idx) => {
          const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
          return (
            <motion.div
              key={cat}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, delay: idx * 0.05 }}
              className="glass card-lift group relative overflow-hidden rounded-2xl p-5"
            >
              <div className="flex items-center justify-between">
                <span className="eyebrow" style={{ color: color.fill }}>{cat}</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-100/45">
                  {list.length} techs
                </span>
              </div>

              <div className="mt-4 aspect-[4/3] w-full">
                <ConstellationSvg
                  skills={list}
                  color={color.fill}
                  onHover={setHovered}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {list.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onMouseEnter={() => setHovered(s)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(s)}
                    onBlur={() => setHovered(null)}
                    className="rounded-full border border-ink-100/15 bg-ink-950/40 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-100/75 transition hover:border-accent/60 hover:text-ink-50"
                    style={{ ["--dot" as string]: color.fill } as React.CSSProperties}
                    data-cursor="hover"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Right: contextual detail panel */}
      <aside className="glass sticky top-24 h-fit rounded-2xl p-6">
        <span className="eyebrow">focus</span>
        {hovered ? (
          <div className="mt-4 space-y-3">
            <p className="font-display text-2xl text-ink-50">{hovered.name}</p>
            <p className="text-sm text-ink-100/70">{hovered.category}</p>
            <p className="text-xs text-ink-100/55">
              A tool in the daily research workflow — used across{" "}
              {contextFor(hovered.category)}.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-100/65">
            Hover any technology to focus. Categories map to research /
            engineering domains; connecting lines suggest common workflow
            adjacencies.
          </p>
        )}
        <div className="mt-6 space-y-2 font-mono text-[11px] text-ink-100/55">
          <p><span className="text-accent">●</span> Node — a technology I actively use.</p>
          <p><span className="text-plum">──</span> Edge — common workflow adjacency.</p>
          <p><span className="text-rose">◇</span> Category — research / engineering domain.</p>
        </div>
      </aside>
    </div>
  );
}

function contextFor(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("vision") || c.includes("image")) return "computer-vision research and medical imaging pipelines";
  if (c.includes("deep") || c.includes("neural")) return "deep-learning experiments and model architectures";
  if (c.includes("data")) return "data engineering, EDA, and applied statistics";
  if (c.includes("web") || c.includes("full")) return "full-stack ML services and portfolio infrastructure";
  if (c.includes("math")) return "mathematical modelling and analysis";
  return "AI engineering and applied research";
}

/* ── SVG constellation ────────────────────────────────────────────────── */

function ConstellationSvg({
  skills,
  color,
  onHover,
}: {
  skills: Skill[];
  color: string;
  onHover: (s: Skill | null) => void;
}) {
  const layout = useMemo(() => {
    // Deterministic positions per category using stable hashing
    const w = 300;
    const h = 220;
    const n = skills.length;
    const cx = w / 2, cy = h / 2;
    const round = (v: number) => Math.round(v * 100) / 100;
    const points = skills.map((s, i) => {
      const seed = hash(`${s.category}-${s.name}`);
      const rand = mulberry(seed);
      const ring = 0.4 + rand() * 0.55;
      const angle = (i / Math.max(n, 6)) * Math.PI * 2 + rand() * 0.6;
      return {
        skill: s,
        x: round(cx + Math.cos(angle) * cx * ring),
        y: round(cy + Math.sin(angle) * cy * ring),
        r: round(4 + (s.proficiency ?? 60) / 30),
      };
    });
    // Build a light adjacency (each node connects to 1-2 neighbours)
    const edges: [number, number][] = [];
    points.forEach((p, i) => {
      let best = -1, bestD = Infinity;
      points.forEach((q, j) => {
        if (i === j) return;
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < bestD) { bestD = d; best = j; }
      });
      if (best >= 0) edges.push([i, best]);
      if (i % 3 === 0) {
        const alt = (i + 2) % points.length;
        if (alt !== i) edges.push([i, alt]);
      }
    });
    return { points, edges, w, h };
  }, [skills]);

  return (
    <svg viewBox={`0 0 ${layout.w} ${layout.h}`} className="h-full w-full">
      <defs>
        <radialGradient id={`grad-${color}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={layout.w / 2} cy={layout.h / 2} r={layout.w / 2.4} fill={`url(#grad-${color})`} />

      {layout.edges.map(([a, b], k) => {
        const p = layout.points[a], q = layout.points[b];
        return (
          <line
            key={k}
            x1={p.x} y1={p.y} x2={q.x} y2={q.y}
            stroke={color} strokeOpacity={0.25} strokeWidth={0.9}
          />
        );
      })}

      {layout.points.map((p, i) => (
        <g
          key={i}
          transform={`translate(${p.x} ${p.y})`}
          onMouseEnter={() => onHover(p.skill)}
          onMouseLeave={() => onHover(null)}
          onFocus={() => onHover(p.skill)}
          onBlur={() => onHover(null)}
          tabIndex={-1}
          className="cursor-pointer"
        >
          <circle r={p.r + 4} fill={color} opacity={0.12} />
          <circle r={p.r} fill={color}>
            <animate
              attributeName="opacity"
              values="0.85;1;0.85"
              dur={`${2 + (i % 4) * 0.4}s`}
              repeatCount="indefinite"
            />
          </circle>
          <text
            y={-p.r - 6}
            textAnchor="middle"
            fontSize="7"
            fill="rgb(232 238 252)"
            style={{ fontFamily: "var(--font-mono), monospace" }}
            opacity={0.85}
          >
            {p.skill.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry(seed: number) {
  let t = seed;
  return function () {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
