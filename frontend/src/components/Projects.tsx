"use client";

import { motion } from "framer-motion";
import Section from "./Section";
import TiltCard from "./TiltCard";
import type { Project } from "@/lib/api";

/** Deterministic hash for stable but varied per-project accents. */
function pickAccent(id: number): { from: string; to: string; hue: number } {
  const palettes = [
    { from: "hsl(190 96% 66%)", to: "hsl(260 76% 66%)", hue: 190 },
    { from: "hsl(260 76% 66%)", to: "hsl(320 76% 68%)", hue: 260 },
    { from: "hsl(160 68% 62%)", to: "hsl(200 88% 66%)", hue: 160 },
    { from: "hsl(30 90% 65%)", to: "hsl(340 78% 66%)", hue: 30 },
    { from: "hsl(220 88% 68%)", to: "hsl(190 96% 66%)", hue: 220 },
  ];
  return palettes[Math.abs(id) % palettes.length];
}

function ProjectCover({ project, accent }: { project: Project; accent: ReturnType<typeof pickAccent> }) {
  return (
    <div className="relative h-40 overflow-hidden rounded-2xl border border-ink-100/10">
      {/* Base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 100% at 0% 0%, ${accent.from} 0%, transparent 60%), radial-gradient(120% 100% at 100% 100%, ${accent.to} 0%, transparent 60%), rgb(var(--ink-950))`,
        }}
      />
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "22px 22px, 22px 22px",
        }}
      />
      {/* Signature glyph — a small computer-vision inspired sketch that varies per project */}
      <svg viewBox="0 0 300 160" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id={`stroke-${project.id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e8eeff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#e8eeff" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <ProjectGlyph project={project} />
        <g stroke={`url(#stroke-${project.id})`} strokeWidth="1" fill="none" opacity="0.7">
          <circle cx="150" cy="80" r="34" />
          <circle cx="150" cy="80" r="54" strokeDasharray="2 4" />
          <circle cx="150" cy="80" r="72" strokeDasharray="1 6" />
        </g>
      </svg>
      {/* Read overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 to-transparent" />
    </div>
  );
}

function ProjectGlyph({ project }: { project: Project }) {
  const tech = project.tech_stack.join(" ").toLowerCase();
  const isVision = /vision|opencv|image|yolo|resnet|vit|cnn|classification/.test(tech + " " + project.title.toLowerCase());
  const isNLP = /nlp|transformer|bert|phishing|text/.test(tech + " " + project.title.toLowerCase());
  const isFullStack = /react|next|full|api|fastapi/.test(tech);

  if (isVision) {
    return (
      <g>
        <rect x="30" y="30" width="100" height="100" rx="4" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.35)" />
        {[45, 65, 85, 105].map((y) => (
          <line key={y} x1="30" y1={y} x2="130" y2={y} stroke="rgba(255,255,255,0.15)" />
        ))}
        {[50, 70, 90, 110].map((x) => (
          <line key={x} x1={x} y1="30" x2={x} y2="130" stroke="rgba(255,255,255,0.15)" />
        ))}
        <rect x="55" y="55" width="50" height="35" fill="none" stroke="rgba(232,238,255,0.9)" strokeWidth="1.5" />
        <circle cx="80" cy="72" r="4" fill="rgba(232,238,255,0.95)" />
        {/* Feature lines going right */}
        <g stroke="rgba(232,238,255,0.4)">
          <line x1="130" y1="60" x2="200" y2="55" />
          <line x1="130" y1="80" x2="200" y2="80" />
          <line x1="130" y1="100" x2="200" y2="105" />
        </g>
        {/* Right prediction bars */}
        <g fill="rgba(232,238,255,0.85)">
          <rect x="200" y="50" width="60" height="6" opacity="0.9" />
          <rect x="200" y="75" width="42" height="6" opacity="0.6" />
          <rect x="200" y="100" width="24" height="6" opacity="0.35" />
        </g>
      </g>
    );
  }
  if (isNLP) {
    return (
      <g>
        {[45, 75, 105, 135, 165, 195, 225, 255].map((x, i) => (
          <g key={x}>
            <circle cx={x} cy="45" r="4" fill="rgba(232,238,255,0.7)" />
            <circle cx={x} cy="120" r="4" fill="rgba(232,238,255,0.7)" />
            {i > 0 && (
              <>
                <line x1={x - 30} y1="45" x2={x} y2="120" stroke="rgba(232,238,255,0.15)" />
                <line x1={x - 30} y1="120" x2={x} y2="45" stroke="rgba(232,238,255,0.15)" />
              </>
            )}
          </g>
        ))}
        <text x="150" y="82" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="rgba(232,238,255,0.55)" letterSpacing="2">
          TRANSFORMER
        </text>
      </g>
    );
  }
  if (isFullStack) {
    return (
      <g>
        <rect x="30" y="40" width="80" height="80" rx="4" fill="none" stroke="rgba(232,238,255,0.6)" />
        <rect x="45" y="55" width="50" height="10" fill="rgba(232,238,255,0.35)" />
        <rect x="45" y="70" width="35" height="4" fill="rgba(232,238,255,0.25)" />
        <rect x="45" y="80" width="45" height="4" fill="rgba(232,238,255,0.25)" />
        <rect x="45" y="90" width="28" height="4" fill="rgba(232,238,255,0.25)" />
        <g stroke="rgba(232,238,255,0.4)" strokeDasharray="3 3">
          <line x1="110" y1="60" x2="170" y2="60" />
          <line x1="110" y1="100" x2="170" y2="100" />
        </g>
        <rect x="170" y="40" width="80" height="80" rx="4" fill="none" stroke="rgba(232,238,255,0.6)" />
        <circle cx="210" cy="80" r="18" fill="none" stroke="rgba(232,238,255,0.85)" strokeWidth="1.5" />
        <circle cx="210" cy="80" r="6" fill="rgba(232,238,255,0.85)" />
      </g>
    );
  }
  return (
    <g>
      <polygon points="150,30 220,80 150,130 80,80" fill="none" stroke="rgba(232,238,255,0.7)" strokeWidth="1.5" />
      <polygon points="150,50 200,80 150,110 100,80" fill="rgba(232,238,255,0.08)" stroke="rgba(232,238,255,0.5)" />
      <circle cx="150" cy="80" r="6" fill="rgba(232,238,255,0.95)" />
    </g>
  );
}

export default function Projects({ items }: { items: Project[] }) {
  return (
    <Section id="projects" index="04" eyebrow="Projects" title={<>projects</>}
      intro="Selected computer vision, NLP, and full-stack ML systems — links to code and demos where public.">
      <div className="grid gap-6 md:grid-cols-2">
        {items.map((p, i) => {
          const accent = pickAccent(p.id);
          const category = /vision|image|opencv|classif/i.test(p.tech_stack.join(" ") + " " + p.title)
            ? "COMPUTER VISION"
            : /nlp|transformer|phishing|text/i.test(p.tech_stack.join(" ") + " " + p.title)
            ? "NATURAL LANGUAGE"
            : /full|next|api|stack|web/i.test(p.tech_stack.join(" "))
            ? "FULL-STACK ML"
            : "APPLIED AI";

          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="group"
            >
              <TiltCard className="glass card-lift overflow-hidden rounded-3xl p-6">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full opacity-30 blur-3xl transition-opacity duration-500 group-hover:opacity-60"
                  style={{ background: accent.from }}
                />
                <div className="relative" style={{ transform: "translateZ(40px)" }}>
                  <ProjectCover project={p} accent={accent} />

                  <div className="mt-5 flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-[0.28em]" style={{ color: accent.from }}>
                      {category}
                    </p>
                    <p className="font-mono text-xs text-ink-100/45">{p.year}</p>
                  </div>

                  <h3 className="mt-2 font-display text-2xl leading-snug text-ink-50">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-sm text-ink-100/75">{p.summary}</p>

                  {p.achievements.length > 0 && (
                    <ul className="mt-4 space-y-2 text-sm text-ink-100/70">
                      {p.achievements.slice(0, 3).map((a) => (
                        <li key={a} className="flex gap-2">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: accent.from }} />
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {p.tech_stack.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {p.tech_stack.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-ink-100/12 bg-ink-950/40 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-widest text-ink-100/70"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-5 flex items-center justify-between">
                    <div className="flex flex-wrap gap-2 font-mono text-xs">
                      {p.repo_url && (
                        <a
                          href={p.repo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-accent/30 px-3 py-1 text-accent/90 transition hover:border-accent hover:text-accent"
                        >
                          Repo ↗
                        </a>
                      )}
                      {p.demo_url && (
                        <a
                          href={p.demo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-plum/40 px-3 py-1 text-plum transition hover:border-plum hover:text-plum"
                        >
                          Demo ↗
                        </a>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-ink-100/50 transition group-hover:text-accent">
                      view case
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden className="transition-transform group-hover:translate-x-1">
                        <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </div>
                </div>
              </TiltCard>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}
