"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Profile } from "@/lib/api";
import SocialIcons from "./SocialIcons";

const HeroScene3D = dynamic(() => import("./HeroScene3D"), {
  ssr: false,
  loading: () => null,
});

type PublicField = { key: string; value: string | null; kind: string };

function humanKey(key: string): string {
  return key.replace(/[_-]+/g, " ");
}

function isLikelyUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/api\/?$/, "") ?? "";

function resolvePhoto(url: string | null | undefined): string {
  if (!url) return "/images/avatar.png";
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url}`;
}

export default function Hero({
  profile,
  customFields = [],
}: {
  profile: Profile;
  customFields?: PublicField[];
}) {
  const [avatarSrc, setAvatarSrc] = useState(resolvePhoto(profile.photo_url));

  return (
    <section
      id="about"
      className="section-anchor relative isolate min-h-[680px] overflow-hidden pb-12 pt-12 md:min-h-[760px] md:pt-16"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <HeroScene3D />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-white/55 via-white/70 to-white"
      />
      <div className="mx-auto max-w-5xl px-6 md:px-10">
      <header className="border-b border-ink-100/10 pb-6">
        <h1 className="font-display text-display-xl tracking-tight text-ink-50">
          <span className="font-semibold">{profile.name}</span>
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-100/70">
          Ph.D. Scholar in Mathematics with Data Science ·{" "}
          <span className="text-accent">Hindustan Institute of Technology and Science</span>,
          Chennai. Data Science Trainer{" "}
          <span className="text-ink-100/55">@ ISBR Business School</span> · Data Analyst Trainer{" "}
          <span className="text-ink-100/55">@ Guardians EdTech</span>.{" "}
          <a href={`mailto:${profile.email}`} className="text-accent hover:underline">
            {profile.email}
          </a>
        </p>
      </header>

      <div className="mt-10 grid gap-10 md:grid-cols-[1fr_240px] md:items-start">
        <div className="space-y-5 text-[15px] leading-relaxed text-ink-100/85">
          <p>{profile.summary}</p>
          <p>
            My research focuses on{" "}
            <span className="text-ink-50">mathematical modelling for computer vision and medical
            image analysis</span>, with active work in gastrointestinal endoscopy classification,
            fuzzy-logic ensembles, and transformer-based phishing detection. Patent-holder for a
            real-time pothole identification system. I also teach applied statistics, ML, and data
            engineering to graduate students.
          </p>
          <p className="text-ink-100/65">
            I am{" "}
            <span className="text-ink-50">open to research collaborations and engineering roles</span>{" "}
            in computer vision, NLP, and full-stack ML. The site mirrors my résumé — see{" "}
            <a href="#news" className="text-accent hover:underline">news</a>,{" "}
            <a href="#research" className="text-accent hover:underline">selected publications</a>,
            and{" "}
            <a href="#projects" className="text-accent hover:underline">projects</a>. The{" "}
            <a href="#assistant" className="text-accent hover:underline">AI assistant</a> answers
            questions about my work grounded in this profile.
          </p>
        </div>

        <aside className="md:sticky md:top-24">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarSrc}
            onError={() => setAvatarSrc("/images/avatar-placeholder.svg")}
            alt={`${profile.name} portrait`}
            width={240}
            height={240}
            className="aspect-square w-full max-w-[240px] rounded-md border border-ink-100/15 object-cover shadow-[0_24px_60px_-28px_rgba(0,0,0,0.35)]"
          />
          <address className="mt-4 not-italic font-mono text-[11px] leading-relaxed text-ink-100/65">
            <div className="text-ink-100/45">// contact</div>
            <div className="text-ink-50">{profile.phone}</div>
            <div>{profile.location}</div>
          </address>

          {customFields.length > 0 && (
            <div className="mt-4 font-mono text-[11px] leading-relaxed text-ink-100/65">
              <p className="text-ink-100/45">// more</p>
              <dl className="mt-2 space-y-2">
                {customFields.map((f) => {
                  const value = (f.value ?? "").trim();
                  if (!value) return null;
                  const renderUrl =
                    f.kind === "url" || (f.kind !== "json" && isLikelyUrl(value));
                  return (
                    <div key={f.key}>
                      <dt className="text-ink-100/45">{humanKey(f.key)}</dt>
                      <dd className="text-ink-50">
                        {renderUrl ? (
                          <a
                            href={value}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent hover:underline"
                          >
                            {value.replace(/^https?:\/\//, "")}
                          </a>
                        ) : f.kind === "json" ? (
                          <code className="block whitespace-pre-wrap break-words text-[11px]">
                            {value}
                          </code>
                        ) : (
                          <span className="whitespace-pre-wrap break-words">{value}</span>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          )}
        </aside>
      </div>

        <SocialIcons links={profile.links} email={profile.email} className="mt-10 justify-center md:justify-start" />
      </div>
    </section>
  );
}
