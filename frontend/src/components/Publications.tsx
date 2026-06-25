"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import Section from "./Section";
import type { Publication } from "@/lib/api";

const PaperOrbit = dynamic(() => import("./PaperOrbit"), {
  ssr: false,
  loading: () => <div className="h-[460px] w-full" />,
});

const FILTERS = ["all", "journal", "conference", "patent"] as const;
type Filter = (typeof FILTERS)[number];

const KIND_STYLES: Record<Publication["kind"], string> = {
  journal: "text-accent border-accent/40",
  conference: "text-plum border-plum/40",
  patent: "text-rose border-rose/40",
};

export default function Publications({ items }: { items: Publication[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((p) => p.kind === filter)),
    [items, filter],
  );

  return (
    <Section
      id="research"
      index="03"
      eyebrow="Research"
      title={<>selected publications</>}
      intro="Peer-reviewed research across deep learning, computer vision, mathematical modelling, and cybersecurity. Filter by type below."
    >
      <div className="glass relative mb-10 overflow-hidden rounded-3xl">
        <PaperOrbit publications={items} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink-950/60" />
        <div className="pointer-events-none absolute bottom-4 left-6 right-6 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-widest text-ink-100/55">
          <span>// drag to orbit · {items.length} publications</span>
          <span className="flex gap-3">
            <span className="text-accent">● journal</span>
            <span className="text-plum">● conference</span>
            <span className="text-rose">● patent</span>
          </span>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest transition ${
              filter === f
                ? "border-accent bg-accent/15 text-accent"
                : "border-ink-100/15 text-ink-100/60 hover:border-ink-100/40 hover:text-ink-50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((p, i) => (
          <motion.article
            key={p.id}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.35, delay: i * 0.03 }}
            className="glass group relative overflow-hidden rounded-2xl p-6 transition hover:border-accent/40"
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-widest ${KIND_STYLES[p.kind]}`}
              >
                {p.kind}
              </span>
              <span className="font-mono text-xs text-ink-100/45">{p.year}</span>
            </div>
            <h3 className="mt-4 font-display text-lg leading-snug text-ink-50">
              {p.title}
            </h3>
            <p className="mt-2 text-xs text-ink-100/65">{p.authors}</p>
            <p className="mt-2 text-xs italic text-ink-100/55">{p.venue}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-xs">
              {p.url && (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  data-track-download={`paper:${p.id}`}
                  className="inline-flex items-center gap-1 rounded-full border border-accent/30 px-2.5 py-1 text-accent/90 transition hover:border-accent hover:text-accent"
                >
                  Open PDF ↗
                </a>
              )}
              {p.doi && (
                <a
                  href={`https://doi.org/${p.doi}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent/90 hover:text-accent"
                >
                  doi:{p.doi}↗
                </a>
              )}
            </div>
          </motion.article>
        ))}
      </div>
    </Section>
  );
}
