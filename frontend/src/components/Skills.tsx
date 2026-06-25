"use client";

import { motion } from "framer-motion";
import Section from "./Section";
import type { Skill } from "@/lib/api";

export default function Skills({ items }: { items: Skill[] }) {
  const grouped = items.reduce<Record<string, Skill[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  return (
    <Section
      id="skills"
      index="05"
      eyebrow="Skills"
      title={<>skills</>}
    >
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(grouped).map(([category, skills]) => (
          <div key={category} className="glass rounded-2xl p-6">
            <h3 className="eyebrow">{category}</h3>
            <ul className="mt-5 space-y-3.5">
              {skills.map((s, i) => (
                <li key={s.id}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-ink-50">{s.name}</span>
                    <span className="font-mono text-ink-100/55">{s.proficiency}</span>
                  </div>
                  <div className="h-[3px] overflow-hidden rounded-full bg-ink-100/10">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${s.proficiency}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, delay: i * 0.04, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-accent via-plum to-rose"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
