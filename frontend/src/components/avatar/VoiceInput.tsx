"use client";

import { useEffect, useRef, useState } from "react";
import { SpeechToText, isSpeechRecognitionSupported } from "@/lib/speech/SpeechToText";

type Props = {
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
  disabled?: boolean;
};

export default function VoiceInput({
  onFinal,
  onInterim,
  onStart,
  onEnd,
  onError,
  disabled,
}: Props) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const sttRef = useRef<SpeechToText | null>(null);

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
    sttRef.current = new SpeechToText();
    return () => sttRef.current?.abort();
  }, []);

  const toggle = () => {
    if (disabled || !supported) return;
    if (listening) {
      sttRef.current?.stop();
      return;
    }
    sttRef.current?.start({
      onStart: () => {
        setListening(true);
        onStart?.();
      },
      onInterim: (t) => onInterim?.(t),
      onFinal: (t) => onFinal(t),
      onError: (m) => {
        setListening(false);
        onError?.(m);
      },
      onEnd: () => {
        setListening(false);
        onEnd?.();
      },
    });
  };

  if (!supported) {
    return (
      <button
        type="button"
        disabled
        title="Voice input isn't available in this browser. Use the text box below."
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink-100/15 bg-ink-950/40 text-ink-100/40"
        aria-label="Voice input unavailable"
      >
        <MicIcon />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "Stop listening" : "Ask by voice"}
      data-cursor="hover"
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition ${
        listening
          ? "border-rose/70 bg-rose/20 text-rose shadow-[0_0_20px_rgba(255,158,199,0.4)]"
          : "border-accent/60 bg-accent/10 text-accent hover:bg-accent/20"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {listening ? <SquareIcon /> : <MicIcon />}
    </button>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SquareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
