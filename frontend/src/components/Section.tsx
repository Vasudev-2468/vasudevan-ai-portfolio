"use client";

import type { ReactNode } from "react";
import SectionHeading from "./ui/SectionHeading";

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
      className="section-anchor relative mx-auto max-w-5xl px-6 py-20 md:px-10 md:py-24"
    >
      <SectionHeading index={index} eyebrow={eyebrow} title={title} intro={intro} />
      {children}
    </section>
  );
}
