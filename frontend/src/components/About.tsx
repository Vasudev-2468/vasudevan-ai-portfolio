"use client";

import dynamic from "next/dynamic";
import Section from "./Section";
import type { Education, Profile, Certification } from "@/lib/api";

const FloatingGeometry = dynamic(() => import("./3d/FloatingGeometry"), { ssr: false, loading: () => null });

export default function About({
  profile,
  education,
  certifications,
}: {
  profile: Profile;
  education: Education[];
  certifications: Certification[];
}) {
  return (
    <Section
      id="background"
      index="01"
      eyebrow="Background"
      title={<>education &amp; recognition</>}
      intro="Degrees, credentials, and the mathematical / research foundation behind the engineering work."
    >
      {/* Intro strip with floating 3D geometry */}
      <div className="glass card-lift mb-8 grid gap-6 overflow-hidden rounded-3xl p-6 md:grid-cols-[1.4fr_1fr] md:p-8">
        <div className="space-y-4">
          <span className="eyebrow">// intelligent systems</span>
          <p className="text-[15px] leading-relaxed text-ink-100/85">
            {profile.summary}
          </p>
          <p className="text-[14px] leading-relaxed text-ink-100/70">
            My research focuses on{" "}
            <span className="text-ink-50">mathematical modelling for computer vision and medical
            image analysis</span> — GI endoscopy classification, fuzzy-logic ensembles, and
            transformer-based phishing detection. Patent-holder for a real-time pothole
            identification system.
          </p>
        </div>
        <div className="relative h-56 md:h-full">
          <FloatingGeometry />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="glass card-lift rounded-2xl p-7">
          <h3 className="eyebrow">Education</h3>
          <ul className="mt-5 space-y-5">
            {education.map((e) => (
              <li key={e.id} className="relative border-l border-accent/40 pl-4">
                <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_2px_hsl(var(--accent-h)_var(--accent-s)_var(--accent-l)/0.7)]" />
                <p className="font-mono text-xs uppercase tracking-widest text-accent/80">{e.year}</p>
                <p className="mt-1 font-display text-xl text-ink-50">{e.degree}</p>
                <p className="text-sm text-ink-100/65">
                  {e.institution} · {e.location}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass card-lift rounded-2xl p-7">
          <h3 className="eyebrow">Certifications & Awards</h3>
          <ul className="mt-5 space-y-4 text-sm">
            {certifications.map((c) => (
              <li key={c.id} className="flex items-start gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-plum" />
                <div>
                  <p className="font-medium text-ink-50">{c.name}</p>
                  <p className="text-ink-100/60">{c.issuer}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
