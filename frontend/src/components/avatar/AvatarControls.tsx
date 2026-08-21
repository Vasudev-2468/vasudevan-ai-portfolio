"use client";

import { useState } from "react";
import VoiceInput from "./VoiceInput";

type Props = {
  onSend: (text: string) => void;
  onVoiceStart?: () => void;
  onVoiceEnd?: () => void;
  onVoiceInterim?: (t: string) => void;
  onVoiceError?: (m: string) => void;
  onStopSpeaking: () => void;
  onToggleMute: () => void;
  onClear: () => void;
  muted: boolean;
  speaking: boolean;
  disabled?: boolean;
};

export default function AvatarControls({
  onSend,
  onVoiceStart,
  onVoiceEnd,
  onVoiceInterim,
  onVoiceError,
  onStopSpeaking,
  onToggleMute,
  onClear,
  muted,
  speaking,
  disabled,
}: Props) {
  const [text, setText] = useState("");

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = text.trim();
          if (!trimmed || disabled) return;
          onSend(trimmed);
          setText("");
        }}
        className="flex items-center gap-2"
      >
        <VoiceInput
          onFinal={(t) => onSend(t)}
          onStart={onVoiceStart}
          onEnd={onVoiceEnd}
          onInterim={onVoiceInterim}
          onError={onVoiceError}
          disabled={disabled}
        />

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask about my research, projects, skills…"
          disabled={disabled}
          className="flex-1 rounded-full border border-ink-100/15 bg-ink-950/50 px-4 py-2.5 text-sm text-ink-50 outline-none transition placeholder:text-ink-100/40 focus:border-accent/60 disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-ink-950 transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
          data-cursor="hover"
        >
          Send
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ink-100/60">
        <button
          type="button"
          onClick={onStopSpeaking}
          disabled={!speaking}
          data-cursor="hover"
          aria-label="Stop the avatar from speaking"
          className="rounded-full border border-ink-100/15 bg-ink-950/40 px-3 py-1 transition hover:border-rose/50 hover:text-rose focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden>■</span> stop speaking
        </button>
        <button
          type="button"
          onClick={onToggleMute}
          data-cursor="hover"
          aria-pressed={muted}
          aria-label={muted ? "Unmute avatar audio" : "Mute avatar audio"}
          className={`rounded-full border px-3 py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
            muted
              ? "border-rose/60 bg-rose/10 text-rose"
              : "border-ink-100/15 bg-ink-950/40 hover:border-accent/50 hover:text-accent"
          }`}
        >
          <span aria-hidden>{muted ? "🔇" : "🔊"}</span> {muted ? "muted" : "sound on"}
        </button>
        <button
          type="button"
          onClick={onClear}
          data-cursor="hover"
          aria-label="Clear conversation and restart the session"
          className="rounded-full border border-ink-100/15 bg-ink-950/40 px-3 py-1 transition hover:border-accent/50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <span aria-hidden>↻</span> restart
        </button>
      </div>
    </div>
  );
}
