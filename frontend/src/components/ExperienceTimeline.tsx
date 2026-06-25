"use client";

import { motion } from "framer-motion";
import Section from "./Section";
import type { Experience } from "@/lib/api";

export default function ExperienceTimeline({ items }: { items: Experience[] }) {
  return (
    <Section
      id="experience"
      index="02"
      eyebrow="Work"
      title={<>experience</>}
    >
      <ol className="relative space-y-6 border-l border-ink-100/15 pl-6 md:pl-10">
        {items.map((exp, i) => (
          <motion.li
            key={exp.id}
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: i * 0.05 }}
            className="relative"
          >
            <span className="absolute -left-[37px] top-3 h-2.5 w-2.5 rounded-full bg-accent shadow-glow md:-left-[43px]" />
            <div className="glass group rounded-2xl p-7 transition hover:border-accent/40">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-2xl text-ink-50">
                  {exp.role}
                  <span className="text-ink-100/55"> · {exp.company}</span>
                </h3>
                <p className="font-mono text-[11px] uppercase tracking-widest text-accent/80">
                  {exp.start_date} — {exp.end_date}
                </p>
              </div>
              <p className="mt-1 text-xs text-ink-100/55">{exp.location}</p>
              <p className="mt-4 text-sm leading-relaxed text-ink-100/80">
                {exp.description}
              </p>
            </div>
          </motion.li>
        ))}
      </ol>
    </Section>
  );
}
