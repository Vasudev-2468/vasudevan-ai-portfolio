"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Section from "./Section";
import type { Experience } from "@/lib/api";

export default function ExperienceTimeline({ items }: { items: Experience[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 80%", "end 20%"],
  });
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <Section
      id="experience"
      index="02"
      eyebrow="Work"
      title={<>experience</>}
      intro="Where I've built, taught, and researched — from data science training to full-stack AI engineering."
    >
      <div ref={ref} className="relative pl-8 md:pl-12">
        {/* Base track */}
        <div className="absolute left-2 top-0 h-full w-px bg-ink-100/10 md:left-4" aria-hidden />
        {/* Animated progress line */}
        <motion.div
          style={{ height: lineHeight }}
          className="absolute left-2 top-0 w-px origin-top bg-gradient-to-b from-accent via-plum to-rose md:left-4"
          aria-hidden
        />

        <ol className="space-y-6">
          {items.map((exp, i) => (
            <motion.li
              key={exp.id}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="relative"
            >
              {/* Node */}
              <span className="absolute -left-[26px] top-6 flex h-4 w-4 items-center justify-center md:-left-[38px]">
                <span className="absolute inset-0 rounded-full bg-accent/30 blur-md" />
                <span className="relative h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_14px_2px_hsl(var(--accent-h)_var(--accent-s)_var(--accent-l)/0.7)]" />
              </span>

              <div className="glass card-lift group rounded-2xl p-6 md:p-7">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-2xl leading-tight text-ink-50">
                    {exp.role}
                    <span className="text-ink-100/55"> · {exp.company}</span>
                  </h3>
                  <p className="rounded-full border border-accent/30 px-3 py-0.5 font-mono text-[11px] uppercase tracking-widest text-accent/90">
                    {exp.start_date} → {exp.end_date}
                  </p>
                </div>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-ink-100/55">
                  {exp.location}
                </p>
                <p className="mt-4 text-sm leading-relaxed text-ink-100/80">
                  {exp.description}
                </p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
