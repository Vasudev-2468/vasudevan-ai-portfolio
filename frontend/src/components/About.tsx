import Section from "./Section";
import type { Education, Profile, Certification } from "@/lib/api";

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
      title={<>education &amp; awards</>}
      intro="Degrees, recognitions, and credentials."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="glass rounded-2xl p-7">
          <h3 className="eyebrow">Education</h3>
          <ul className="mt-5 space-y-5">
            {education.map((e) => (
              <li key={e.id} className="border-l border-accent/40 pl-4">
                <p className="font-mono text-xs uppercase tracking-widest text-accent/80">
                  {e.year}
                </p>
                <p className="mt-1 font-display text-xl text-ink-50">{e.degree}</p>
                <p className="text-sm text-ink-100/65">
                  {e.institution} · {e.location}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass rounded-2xl p-7">
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
