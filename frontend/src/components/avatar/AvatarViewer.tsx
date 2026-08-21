"use client";

/**
 * AvatarViewer — the visual layer.
 *
 * Lip-sync illusion on a single photograph:
 *   1. The photo is rendered TWICE. The upper layer is clipped to the top
 *      ~68% (everything above the mouth line). The lower layer is clipped
 *      to the bottom ~32% (the jaw + chin) and translated *down* by
 *      `mouthLevel * ~7px` on every frame. The gap between them is filled
 *      by a dark "oral cavity" gradient so the mouth reads as physically
 *      open — a real jaw-drop rig, driven by the same audio signal that
 *      drives the TTS.
 *   2. Continuous head-motion primitives — breathing (slow y-translate),
 *      speaking-sway (higher-frequency subtle rotation), and rare
 *      micro-saccades of the whole head — keep the face from ever
 *      looking frozen.
 *   3. Procedural blinks fire every 2.8–5.4s, with a small "look-around"
 *      when idle.
 *
 * When a talking-head provider (D-ID/HeyGen/Simli) is active the
 * `<video>` element takes over and the SVG rig is hidden.
 *
 * The mouth-line ratio and jaw-shift magnitude are tuned for the shipped
 * portrait — they can be overridden per-photo if needed.
 */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { AvatarState } from "@/lib/avatar/types";

type Props = {
  photoUrl: string;
  state: AvatarState;
  mouthLevel: number;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
  providerKind: "browser-photo" | "did" | "heygen" | "simli";
};

// Vertical position of the mouth line (0..1 of image height). Tuned so the
// jaw layer captures the lower lip + chin without slicing the nose.
const MOUTH_LINE = 0.72;
// Max jaw-drop in pixels at mouthLevel=1. Kept small — larger reads as
// uncanny. Roughly ~2% of a 420px avatar.
const MAX_JAW_DROP_PX = 9;

export default function AvatarViewer({
  photoUrl,
  state,
  mouthLevel,
  onVideoRef,
  providerKind,
}: Props) {
  const [blink, setBlink] = useState(false);
  const [saccade, setSaccade] = useState(0); // -1..1 subtle head shift
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  // Read mouth level from a ref inside the rAF loop instead of from a
  // prop closure — otherwise the effect below would tear down and
  // re-schedule the loop on every mouth-level update (60 Hz during
  // speech). This lets React re-render freely without cancelling the
  // animation frame.
  const mouthLevelRef = useRef(mouthLevel);
  const stateRef = useRef(state);
  mouthLevelRef.current = mouthLevel;
  stateRef.current = state;
  const usingVideo = providerKind !== "browser-photo";

  // Procedural blink loop.
  useEffect(() => {
    if (usingVideo) return;
    let alive = true;
    const scheduleNext = () => {
      const delay = 2800 + Math.random() * 2600;
      setTimeout(() => {
        if (!alive) return;
        setBlink(true);
        setTimeout(() => alive && setBlink(false), 130);
        // Occasional double-blink for realism.
        if (Math.random() < 0.15) {
          setTimeout(() => {
            if (!alive) return;
            setBlink(true);
            setTimeout(() => alive && setBlink(false), 110);
          }, 220);
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => {
      alive = false;
    };
  }, [usingVideo]);

  // Micro-saccade loop — subtle head shift, more frequent when idle so
  // the avatar doesn't lock into "statue" mode when nothing is happening.
  useEffect(() => {
    if (usingVideo) return;
    let alive = true;
    const scheduleNext = () => {
      const delay = 1600 + Math.random() * 3800;
      setTimeout(() => {
        if (!alive) return;
        setSaccade((Math.random() - 0.5) * 2);
        // Drift back toward center after a moment.
        setTimeout(() => alive && setSaccade(0), 700 + Math.random() * 500);
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => {
      alive = false;
    };
  }, [usingVideo]);

  // rAF loop for breathing + speaking sway. We drive CSS custom
  // properties on the container so React doesn't have to re-render every
  // frame — cheap enough to run continuously.
  useEffect(() => {
    if (usingVideo) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const el = containerRef.current;
      const s = stateRef.current;
      const m = mouthLevelRef.current;
      if (el) {
        const breathe = Math.sin(t * 0.9) * 0.5; // px
        const sway =
          s === "speaking" ? Math.sin(t * 6.5) * 0.6 * (0.4 + m) : 0;
        const lean = s === "thinking" ? -1.2 : 0;
        el.style.setProperty("--head-y", `${(breathe + lean).toFixed(2)}px`);
        el.style.setProperty("--head-rot", `${sway.toFixed(3)}deg`);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [usingVideo]);

  useEffect(() => {
    if (onVideoRef) onVideoRef(videoRef.current);
  }, [onVideoRef]);

  const openness = Math.max(0, Math.min(1, mouthLevel));
  const jawDropPx = openness * MAX_JAW_DROP_PX;
  // Non-linear widening — big vowels flare wider than small ones.
  const openWidth = 34 + openness * 22; // % of face width
  const openHeight = 1.4 + openness * 6.5; // % of face height

  // Clip paths for the two photo layers. Percentages keep them
  // scale-invariant so the same rig works for any square portrait.
  const upperClip = `polygon(0 0, 100% 0, 100% ${MOUTH_LINE * 100}%, 0 ${MOUTH_LINE * 100}%)`;
  const lowerClip = `polygon(0 ${MOUTH_LINE * 100}%, 100% ${MOUTH_LINE * 100}%, 100% 100%, 0 100%)`;

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-3xl">
      {/* Glow ring — pulses with state */}
      <div
        className={`pointer-events-none absolute -inset-6 rounded-[36px] blur-2xl transition-opacity duration-500 ${
          state === "speaking"
            ? "opacity-75"
            : state === "listening"
              ? "opacity-60"
              : state === "thinking"
                ? "opacity-50"
                : "opacity-30"
        }`}
        style={{
          background:
            "conic-gradient(from 180deg, hsl(var(--accent-h) var(--accent-s) var(--accent-l) / 0.35), rgb(var(--plum) / 0.35), rgb(var(--rose) / 0.35), hsl(var(--accent-h) var(--accent-s) var(--accent-l) / 0.35))",
        }}
        aria-hidden
      />

      <div
        ref={containerRef}
        className="relative h-full w-full overflow-hidden rounded-3xl border border-ink-100/10 bg-ink-950/60 shadow-[inset_0_0_60px_rgba(0,0,0,0.4)]"
        style={{
          // Whole-head transform, updated per-frame by the rAF loop above.
          transform:
            `translate3d(${(saccade * 1.2).toFixed(2)}px, var(--head-y, 0px), 0) rotate(var(--head-rot, 0deg))`,
          transition: "transform 260ms cubic-bezier(0.22, 0.61, 0.36, 1)",
          willChange: "transform",
        }}
      >
        {/* Talking-head video (only when a remote provider is active) */}
        {usingVideo && (
          <video
            ref={(el) => {
              videoRef.current = el;
            }}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            playsInline
            muted={false}
          />
        )}

        {!usingVideo && (
          <>
            {/* Dark oral cavity — sits BEHIND both photo layers. When the
                jaw layer slides down, this is what the viewer sees inside
                the "mouth". A radial gradient gives it depth. */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 26% 8% at 50% 71%, rgba(35,10,18,0.95) 0%, rgba(35,10,18,0.85) 55%, rgba(35,10,18,0) 100%)",
                opacity: 0.15 + openness * 0.85,
                transition: "opacity 40ms linear",
              }}
              aria-hidden
            />

            {/* Upper face — clipped to everything above the mouth line. */}
            <div
              className="absolute inset-0 will-change-transform"
              style={{
                clipPath: upperClip,
                WebkitClipPath: upperClip,
              }}
            >
              <Image
                src={photoUrl}
                alt="AI avatar portrait"
                fill
                priority
                sizes="(min-width: 1024px) 420px, 90vw"
                className="object-cover"
              />
              {/* Blink strip — sits INSIDE the upper layer so it can't leak
                  onto the jaw. Positioned over the eye band. */}
              <div
                className="pointer-events-none absolute left-1/2 top-[37%] h-[3.2%] w-[62%] -translate-x-1/2 rounded-full"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 50%, rgba(0,0,0,0) 100%)",
                  opacity: blink ? 0.9 : 0,
                  transition: "opacity 80ms ease-in-out",
                }}
                aria-hidden
              />
            </div>

            {/* Lower face (jaw + chin) — clipped to everything BELOW the
                mouth line and translated down by the current mouth level.
                Same photo, same crop — the offset creates the illusion of
                the jaw opening. */}
            <div
              className="absolute inset-0 will-change-transform"
              style={{
                clipPath: lowerClip,
                WebkitClipPath: lowerClip,
                transform: `translate3d(0, ${jawDropPx.toFixed(2)}px, 0)`,
                transition: "transform 30ms linear",
              }}
            >
              <Image
                src={photoUrl}
                alt=""
                aria-hidden
                fill
                priority
                sizes="(min-width: 1024px) 420px, 90vw"
                className="object-cover"
              />
              {/* Upper-lip shadow — a thin dark line right along the top
                  edge of the jaw layer that sells the seam. */}
              <div
                className="pointer-events-none absolute inset-x-0"
                style={{
                  top: `${MOUTH_LINE * 100}%`,
                  height: "0.9%",
                  background:
                    "linear-gradient(to bottom, rgba(10,4,8,0.7) 0%, rgba(10,4,8,0) 100%)",
                  opacity: 0.6 + openness * 0.3,
                }}
                aria-hidden
              />
            </div>

            {/* SVG mouth-opening — sits ABOVE both photo layers, in the
                gap the jaw-drop reveals. Actually widens/tallens with
                mouthLevel so vowels read differently from consonants. */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              <defs>
                <radialGradient id="mouth-cavity" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(20,4,10,0.98)" />
                  <stop offset="65%" stopColor="rgba(20,4,10,0.85)" />
                  <stop offset="100%" stopColor="rgba(20,4,10,0)" />
                </radialGradient>
              </defs>
              <ellipse
                cx="50"
                cy={MOUTH_LINE * 100 + jawDropPx * 0.4}
                rx={openWidth / 4}
                ry={openHeight}
                fill="url(#mouth-cavity)"
                opacity={Math.min(1, 0.35 + openness * 0.75)}
                style={{ transition: "opacity 30ms linear" }}
              />
              {/* Highlight glint on the lower lip when open — sells the
                  wetness of a real mouth. */}
              <ellipse
                cx="50"
                cy={MOUTH_LINE * 100 + jawDropPx * 0.4 + openHeight * 0.6}
                rx={openWidth / 5}
                ry={openHeight * 0.14}
                fill="rgba(255,220,225,0.4)"
                opacity={openness * 0.7}
              />
            </svg>

            {/* Subtle scanline overlay for the "AI" feel — kept very low
                opacity so it doesn't distract from the motion. */}
            <div
              className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 3px)",
              }}
              aria-hidden
            />
          </>
        )}

        {/* Bottom gradient + label */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3"
            style={{
              background:
                "linear-gradient(to top, rgb(var(--bg)/0.9) 0%, rgb(var(--bg)/0) 100%)",
            }}
            aria-hidden
          />
          <span className="relative font-mono text-[10px] uppercase tracking-[0.25em] text-ink-100/70">
            ai avatar
          </span>
          <span className="relative font-mono text-[10px] uppercase tracking-[0.25em] text-ink-100/50">
            {providerKind}
          </span>
        </div>
      </div>
    </div>
  );
}
