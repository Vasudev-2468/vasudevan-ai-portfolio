"use client";

import { motion } from "framer-motion";
import Section from "./Section";
import TiltCard from "./TiltCard";
import type { Project } from "@/lib/api";

export default function Projects({ items }: { items: Project[] }) {
  return (
    <Section
      id="projects"
      index="04"
      eyebrow="Projects"
      title={<>projects</>}
    >
      <div className="grid gap-6 md:grid-cols-2">
        {items.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: i * 0.04 }}
            className="group"
          >
            <TiltCard className="glass overflow-hidden rounded-3xl p-7">
              <div
                aria-hidden
                className={`pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full opacity-30 blur-3xl transition-opacity duration-500 group-hover:opacity-60 ${i % 2 ? "bg-accent" : "bg-plum"}`}
              />
              <div className="relative" style={{ transform: "translateZ(40px)" }}>
                <div className="flex items-baseline justify-between">
                  <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent/80">
                    {p.role}
                  </p>
                  <p className="font-mono text-xs text-ink-100/45">{p.year}</p>
                </div>
                <h3 className="mt-3 font-display text-2xl text-ink-50">{p.title}</h3>
                <p className="mt-3 text-sm text-ink-100/75">{p.summary}</p>

                {p.achievements.length > 0 && (
                  <ul className="mt-5 space-y-2 text-sm text-ink-100/70">
                    {p.achievements.slice(0, 3).map((a) => (
                      <li key={a} className="flex gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {p.tech_stack.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-1.5">
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

                {(p.repo_url || p.demo_url) && (
                  <div className="mt-5 flex flex-wrap gap-2 font-mono text-xs">
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
                )}
              </div>
            </TiltCard>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
