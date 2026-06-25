"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export default function Section({
  id,
  index,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string;
  index: string;
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="section-anchor relative mx-auto max-w-5xl px-6 py-16 md:px-10 md:py-20"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
        className="mb-12 grid items-end gap-6 md:grid-cols-[auto_1fr]"
      >
        <div className="font-mono text-xs uppercase tracking-[0.32em] text-accent/70">
          {index} / {eyebrow}
        </div>
        <div>
          <h2 className="font-display text-display-lg tracking-tight">
            {title}
          </h2>
          {intro && (
            <p className="mt-4 max-w-2xl text-ink-100/70">{intro}</p>
          )}
        </div>
      </motion.div>
      {children}
    </section>
  );
}
