"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { motion } from "framer-motion";
import type { Profile } from "@/lib/api";
import SocialIcons from "./SocialIcons";
import MagneticButton from "./ui/MagneticButton";

const AIOrb = dynamic(() => import("./3d/AIOrb"), {
  ssr: false,
  loading: () => <HeroOrbFallback />,
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

/* Staggered reveal */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, duration: 0.7, ease: [0.2, 0.7, 0.2, 1] },
  }),
};

export default function Hero({
  profile,
  customFields = [],
}: {
  profile: Profile;
  customFields?: PublicField[];
}) {
  const [avatarSrc, setAvatarSrc] = useState(resolvePhoto(profile.photo_url));

  const badges = ["Computer Vision", "Deep Learning", "PyTorch", "Mathematical Modelling", "PhD Research"];

  return (
    <section
      id="about"
      className="section-anchor relative isolate overflow-hidden pb-20 pt-24 md:pt-32"
    >
      {/* Background: soft aurora + subtle grid, sits above global backdrop but below content */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 grid-overlay opacity-40" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 60% at 12% 30%, hsl(var(--accent-h) var(--accent-s) var(--accent-l) / 0.14), transparent 70%), radial-gradient(45% 55% at 88% 70%, rgb(var(--plum) / 0.14), transparent 70%)",
          }}
        />
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 md:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
        {/* ── LEFT: copy ────────────────────────────────────────────── */}
        <div>
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
            className="space-y-6"
          >
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 rounded-full border border-ink-100/15 bg-ink-950/40 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-ink-100/70 backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              Open to research collaborations & AI engineering roles
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="font-display text-display-xl tracking-tight text-ink-50"
            >
              <span className="block text-gradient-accent">AI / Computer</span>
              <span className="block">Vision Engineer</span>
            </motion.h1>

            <motion.p variants={fadeUp} custom={2} className="max-w-xl text-[16px] leading-relaxed text-ink-100/80">
              I&apos;m <span className="font-medium text-ink-50">{profile.name}</span> — Ph.D. scholar in Mathematics with Data Science at{" "}
              <span className="text-ink-50">Hindustan Institute of Technology & Science</span>, Chennai.
              Building intelligent systems with{" "}
              <span className="text-ink-50">computer vision</span>,{" "}
              <span className="text-ink-50">deep learning</span>, and mathematical modelling —
              from gastrointestinal endoscopy classifiers to transformer-based phishing detection
              and a real-time pothole identification patent.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="flex flex-wrap gap-3">
              <MagneticButton variant="primary" href="#projects" arrow>
                View my work
              </MagneticButton>
              <MagneticButton
                variant="ghost"
                href="/Resume_updated.pdf"
                target="_blank"
                rel="noreferrer"
                data-track-download="resume"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download résumé
              </MagneticButton>
            </motion.div>

            <motion.ul variants={fadeUp} custom={4} className="flex flex-wrap gap-2 pt-1">
              {badges.map((b) => (
                <li
                  key={b}
                  className="rounded-full border border-ink-100/15 bg-ink-950/40 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-ink-100/75 backdrop-blur"
                >
                  {b}
                </li>
              ))}
            </motion.ul>

            <motion.div variants={fadeUp} custom={5}>
              <SocialIcons links={profile.links} email={profile.email} className="pt-4" />
            </motion.div>

            {customFields.length > 0 && (
              <motion.div variants={fadeUp} custom={6} className="pt-4 font-mono text-[11px] leading-relaxed text-ink-100/65">
                <p className="text-ink-100/45">// more</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                  {customFields.slice(0, 6).map((f) => {
                    const value = (f.value ?? "").trim();
                    if (!value) return null;
                    const renderUrl = f.kind === "url" || (f.kind !== "json" && isLikelyUrl(value));
                    return (
                      <div key={f.key}>
                        <dt className="text-ink-100/45">{humanKey(f.key)}</dt>
                        <dd className="truncate text-ink-50">
                          {renderUrl ? (
                            <a href={value} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                              {value.replace(/^https?:\/\//, "")}
                            </a>
                          ) : (
                            <span>{value}</span>
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* ── RIGHT: 3D AI core + avatar ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.2, ease: [0.2, 0.7, 0.2, 1] }}
          className="relative mx-auto aspect-square w-full max-w-[520px]"
        >
          <div className="absolute inset-0">
            <AIOrb />
          </div>

          {/* HUD frame */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <Corner className="top-0 left-0 rotate-0" />
            <Corner className="top-0 right-0 rotate-90" />
            <Corner className="bottom-0 right-0 rotate-180" />
            <Corner className="bottom-0 left-0 -rotate-90" />
          </div>

          {/* Small avatar chip */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="glass absolute bottom-4 left-4 flex items-center gap-3 rounded-2xl px-3 py-2 pr-4"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarSrc}
              onError={() => setAvatarSrc("/images/avatar-placeholder.svg")}
              alt={`${profile.name} portrait`}
              width={44}
              height={44}
              className="h-11 w-11 rounded-xl border border-ink-100/15 object-cover"
            />
            <div className="text-[11px] leading-tight">
              <p className="font-mono uppercase tracking-widest text-ink-100/55">Live</p>
              <p className="font-medium text-ink-50">{profile.location || "India"}</p>
            </div>
          </motion.div>

          {/* HUD readouts */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.0, duration: 0.6 }}
            className="glass absolute right-3 top-3 rounded-xl px-3 py-2 text-right font-mono text-[10px] uppercase tracking-widest text-ink-100/70"
          >
            <p className="text-accent">// ai core</p>
            <p>state: online</p>
            <p>domain: CV · DL</p>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.8 }}
        className="mx-auto mt-16 flex max-w-6xl items-center justify-center gap-3 px-6 font-mono text-[11px] uppercase tracking-widest text-ink-100/50 md:px-10"
      >
        <span className="h-px w-8 bg-ink-100/25" />
        <span>scroll to explore</span>
        <span className="h-px w-8 bg-ink-100/25" />
      </motion.div>
    </section>
  );
}

function Corner({ className }: { className?: string }) {
  return (
    <div className={`absolute h-8 w-8 ${className}`}>
      <div className="absolute inset-0 border-l border-t border-accent/60" />
    </div>
  );
}

function HeroOrbFallback() {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div className="h-40 w-40 animate-pulse rounded-full bg-gradient-to-br from-accent/20 to-plum/20 blur-2xl" />
      <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] uppercase tracking-widest text-ink-100/50">
        initializing ai core
      </div>
    </div>
  );
}
