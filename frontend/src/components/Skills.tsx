"use client";

import Section from "./Section";
import SkillsConstellation from "./3d/SkillsConstellation";
import type { Skill } from "@/lib/api";

export default function Skills({ items }: { items: Skill[] }) {
  if (!items.length) {
    return (
      <Section id="skills" index="05" eyebrow="Skills" title={<>skills</>}>
        <div className="glass rounded-2xl p-8 text-sm text-ink-100/60">
          Skill data is currently unavailable — the constellation renders once the backend responds.
        </div>
      </Section>
    );
  }

  return (
    <Section
      id="skills"
      index="05"
      eyebrow="Skills"
      title={<>technology network</>}
      intro="Each category is a small constellation of tools I actively use in research and engineering. Hover any node to focus."
    >
      <SkillsConstellation items={items} />
    </Section>
  );
}
