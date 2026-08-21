"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  index: string;
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: "left" | "center";
};

export default function SectionHeading({ index, eyebrow, title, intro, align = "left" }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
      className={`mb-12 ${align === "center" ? "text-center" : ""}`}
    >
      <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.32em] text-accent/80">
        <span className="h-px w-6 bg-accent/50" />
        <span>{index}</span>
        <span>/</span>
        <span>{eyebrow}</span>
      </div>
      <h2 className="mt-4 font-display text-display-lg tracking-tight text-gradient-accent">
        {title}
      </h2>
      {intro && <p className="mt-4 max-w-2xl text-ink-100/70">{intro}</p>}
    </motion.div>
  );
}
