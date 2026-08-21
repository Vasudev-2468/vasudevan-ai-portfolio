"use client";

import type { AvatarState } from "@/lib/avatar/types";

const LABELS: Record<AvatarState, string> = {
  idle: "Ask me anything",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  error: "Something went wrong",
};

const DOT: Record<AvatarState, string> = {
  idle: "bg-ink-100/40",
  listening: "bg-accent shadow-[0_0_10px_2px_hsl(var(--accent-h)_var(--accent-s)_var(--accent-l)/0.7)] animate-blink",
  thinking: "bg-plum shadow-[0_0_10px_2px_rgb(var(--plum)/0.7)] animate-blink",
  speaking: "bg-rose shadow-[0_0_10px_2px_rgb(var(--rose)/0.7)]",
  error: "bg-ink-100/60",
};

export default function AvatarStatus({ state }: { state: AvatarState }) {
  return (
    <div
      className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-ink-100/70"
      role="status"
      aria-live="polite"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[state]}`} aria-hidden />
      <span>{LABELS[state]}</span>
    </div>
  );
}
