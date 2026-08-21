"use client";

/**
 * Thin wrapper around the browser SpeechRecognition API.
 *
 *  - Feature-detects both `SpeechRecognition` and the WebKit-prefixed name.
 *  - Emits `interim` transcripts (while the user is speaking) and a final
 *    `final` transcript on end.
 *  - `isSupported()` lets callers show a text-input fallback in browsers
 *    without support (Firefox, Safari on some platforms).
 *  - Never touches the microphone until `start()` is called from a user
 *    gesture, so the browser handles the permission prompt.
 */

type SR = typeof window extends { SpeechRecognition: infer T }
  ? T
  : unknown;

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((e: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionResultEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

type Ctor = SpeechRecognitionCtor | undefined;
function getCtor(): Ctor {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function isSpeechRecognitionSupported(): boolean {
  return !!getCtor();
}

export type SttCallbacks = {
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
  onStart?: () => void;
};

export class SpeechToText {
  private rec: SpeechRecognitionInstance | null = null;
  private active = false;

  start(cb: SttCallbacks): boolean {
    const Ctor = getCtor();
    if (!Ctor) {
      cb.onError?.("Speech recognition isn't supported in this browser.");
      return false;
    }
    if (this.active) return true;

    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    let finalTranscript = "";
    rec.onresult = (e: SpeechRecognitionResultEvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) finalTranscript += t;
        else interim += t;
      }
      if (interim) cb.onInterim?.(interim.trim());
    };
    rec.onerror = (e) => {
      const msg =
        e.error === "not-allowed"
          ? "Microphone permission was denied."
          : e.error === "no-speech"
            ? "I didn't catch that — try again."
            : `Speech error: ${e.error ?? "unknown"}`;
      cb.onError?.(msg);
    };
    rec.onstart = () => cb.onStart?.();
    rec.onend = () => {
      this.active = false;
      const trimmed = finalTranscript.trim();
      if (trimmed) cb.onFinal?.(trimmed);
      cb.onEnd?.();
    };

    this.rec = rec;
    this.active = true;
    try {
      rec.start();
      return true;
    } catch (err) {
      cb.onError?.(err instanceof Error ? err.message : "Couldn't start microphone.");
      this.active = false;
      return false;
    }
  }

  stop(): void {
    if (this.rec && this.active) {
      try {
        this.rec.stop();
      } catch {
        /* noop */
      }
    }
  }

  abort(): void {
    if (this.rec && this.active) {
      try {
        this.rec.abort();
      } catch {
        /* noop */
      }
      this.active = false;
    }
  }
}

// Type-only export so unused-import lints don't fire elsewhere.
export type { SR };
