"use client";

/**
 * BrowserPhotoProvider — the default, zero-key avatar provider.
 *
 * Two audio paths, one interface:
 *
 *   1. Server-TTS path (when `/api/avatar/tts` is configured with an
 *      ElevenLabs key): decodes the returned MP3 through Web Audio,
 *      routes it through an AnalyserNode, and emits per-frame RMS values
 *      that the viewer uses to drive the mouth-mask openness. This is a
 *      real amplitude-based lip-sync engine.
 *
 *   2. Browser-TTS path (default): uses `speechSynthesis` and drives the
 *      mouth from `SpeechSynthesisUtterance.onboundary` events (word-level
 *      timing coming out of the same engine that's producing the audio),
 *      plus a low-frequency modulation to give the mouth natural motion
 *      between word boundaries.
 *
 * Both paths call `onMouthLevel(0..1)` on every animation frame.
 */

import type {
  AvatarProvider,
  AvatarProviderInit,
  MouthLevelCallback,
  SpeakOptions,
} from "../types";

const AUDIO_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

export class BrowserPhotoProvider implements AvatarProvider {
  readonly kind = "browser-photo" as const;

  private config: AvatarProviderInit | null = null;
  private ctx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private rafId: number | null = null;
  private muted = false;
  private disposed = false;
  private preferredVoice: SpeechSynthesisVoice | null = null;

  async init(config: AvatarProviderInit): Promise<void> {
    this.config = config;
    // Preload TTS voices. Chrome returns [] synchronously and populates
    // via `voiceschanged`; if we don't wait, the first utterance falls
    // back to the OS default (usually a robotic Microsoft SAPI voice on
    // Windows). Waiting up to 500ms is imperceptible on Start.
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.preferredVoice = await pickNaturalVoice();
    }
    // Lazy-create the AudioContext on the first user gesture. Browsers
    // block AudioContext creation until then, so init() alone is fine.
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      if (this.currentSource) this.currentSource.disconnect();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    }
  }

  stop(): void {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        /* already stopped */
      }
      this.currentSource.disconnect();
      this.currentSource = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    this.currentUtterance = null;
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  async speak(opts: SpeakOptions): Promise<void> {
    if (this.disposed || !this.config) return;

    // Try server TTS first if available. Fall back to browser TTS on any
    // error (network, 501, decode failure).
    if (this.config.serverTtsAvailable) {
      try {
        await this.speakServer(opts);
        return;
      } catch {
        /* fall through to browser TTS */
      }
    }

    await this.speakBrowser(opts);
  }

  // ---------------------------------------------------------------------------
  // Server-TTS path — full Web Audio lip-sync
  // ---------------------------------------------------------------------------

  private async speakServer(opts: SpeakOptions): Promise<void> {
    const res = await fetch(`${AUDIO_BASE}/avatar/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: opts.text,
        voice: this.config?.voiceId ?? undefined,
      }),
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(`tts ${res.status}`);
    const buf = await res.arrayBuffer();

    const ctx = this.ensureAudioContext();
    if (ctx.state === "suspended") await ctx.resume();

    const audioBuf = await ctx.decodeAudioData(buf.slice(0));

    const source = ctx.createBufferSource();
    source.buffer = audioBuf;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.5;

    const gain = ctx.createGain();
    gain.gain.value = this.muted ? 0 : 1;

    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(ctx.destination);

    this.currentSource = source;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (!this.currentSource) return;
      analyser.getByteFrequencyData(data);
      // Weight the mid-band (voice formants) higher; the lowest bins hold
      // rumble and the top bins hold noise.
      let sum = 0;
      let weight = 0;
      const midStart = Math.floor(data.length * 0.05);
      const midEnd = Math.floor(data.length * 0.6);
      for (let i = midStart; i < midEnd; i++) {
        sum += data[i];
        weight += 1;
      }
      const avg = sum / (weight * 255);
      // Non-linear curve — quiet passages stay closed, loud vowels open wide.
      const level = Math.min(1, Math.pow(avg * 1.8, 1.3));
      opts.onMouthLevel?.(level);
      this.rafId = requestAnimationFrame(tick);
    };

    return new Promise<void>((resolve) => {
      const cleanup = () => {
        if (this.rafId != null) cancelAnimationFrame(this.rafId);
        this.rafId = null;
        opts.onMouthLevel?.(0);
        try {
          source.disconnect();
          analyser.disconnect();
          gain.disconnect();
        } catch {
          /* noop */
        }
        this.currentSource = null;
        resolve();
      };

      source.onended = cleanup;
      opts.signal?.addEventListener("abort", () => {
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
        cleanup();
      });

      this.rafId = requestAnimationFrame(tick);
      source.start();
    });
  }

  // ---------------------------------------------------------------------------
  // Browser-TTS path — timing-driven mouth animation
  // ---------------------------------------------------------------------------

  private async speakBrowser(opts: SpeakOptions): Promise<void> {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      // No TTS at all — animate mouth briefly to indicate "spoke", then
      // resolve. The UI shows the answer as text in the transcript.
      await this.silentMouthFlicker(opts);
      return;
    }

    const utter = new SpeechSynthesisUtterance(opts.text);
    // Conversational register: slightly slower than default and a hair
    // above nominal pitch — both make most browser voices land closer to
    // a natural speaking cadence and away from "assistant announcement"
    // reads. The neural voices (Google / Microsoft *Neural*) sound
    // especially close to human at these settings.
    utter.rate = 0.95;
    utter.pitch = 1.02;
    utter.volume = this.muted ? 0 : 1;
    // Pick the best available voice — refresh in case new voices loaded
    // between init and the first speak call.
    if (!this.preferredVoice) {
      this.preferredVoice = await pickNaturalVoice();
    }
    if (this.preferredVoice) utter.voice = this.preferredVoice;

    this.currentUtterance = utter;

    return new Promise<void>((resolve) => {
      let startedAt = 0;
      let running = true;
      let currentBoundary = 0; // seconds

      const tick = (now: number) => {
        if (!running) return;
        const elapsed = (now - startedAt) / 1000;
        // Base amplitude from a slow LF oscillation, boosted around each
        // word boundary. Result reads as natural mouth motion synced to
        // word timing.
        const sinceBoundary = elapsed - currentBoundary;
        const decay = Math.exp(-sinceBoundary * 2.5);
        const base = 0.15 + 0.15 * (Math.sin(elapsed * 11) * 0.5 + 0.5);
        const level = Math.min(1, base + decay * 0.55);
        opts.onMouthLevel?.(level);
        this.rafId = requestAnimationFrame(tick);
      };

      utter.onstart = (e) => {
        startedAt = performance.now() - ((e as SpeechSynthesisEvent).elapsedTime ?? 0);
        this.rafId = requestAnimationFrame(tick);
      };
      utter.onboundary = (e) => {
        currentBoundary = ((e as SpeechSynthesisEvent).elapsedTime ?? 0) / 1000;
      };
      const finish = () => {
        running = false;
        if (this.rafId != null) cancelAnimationFrame(this.rafId);
        this.rafId = null;
        opts.onMouthLevel?.(0);
        this.currentUtterance = null;
        resolve();
      };
      utter.onend = finish;
      utter.onerror = finish;

      opts.signal?.addEventListener("abort", () => {
        window.speechSynthesis.cancel();
        finish();
      });

      // On some browsers speechSynthesis silently drops utterances if the
      // queue is stale — cancel first, then defer the speak() past the
      // current task. Chrome (and iOS Safari especially) will otherwise
      // drop the utterance when cancel + speak fire in the same tick.
      window.speechSynthesis.cancel();
      setTimeout(() => {
        if (this.disposed) return finish();
        window.speechSynthesis.speak(utter);
      }, 60);
    });
  }

  private async silentMouthFlicker(opts: SpeakOptions): Promise<void> {
    // No TTS engine at all. Emit a short synthetic envelope roughly
    // proportional to text length so the avatar visibly "acknowledges"
    // the answer while the transcript renders.
    const durMs = Math.min(6000, 250 + opts.text.length * 25);
    const start = performance.now();
    return new Promise<void>((resolve) => {
      const step = (now: number) => {
        const t = (now - start) / durMs;
        if (t >= 1) {
          opts.onMouthLevel?.(0);
          return resolve();
        }
        const level = Math.max(0, Math.sin(t * Math.PI * 6)) * 0.5;
        opts.onMouthLevel?.(level);
        this.rafId = requestAnimationFrame(step);
      };
      this.rafId = requestAnimationFrame(step);
      opts.signal?.addEventListener("abort", () => {
        if (this.rafId != null) cancelAnimationFrame(this.rafId);
        opts.onMouthLevel?.(0);
        resolve();
      });
    });
  }

  private ensureAudioContext(): AudioContext {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
    }
    return this.ctx;
  }
}

export type { MouthLevelCallback };

/* -----------------------------------------------------------------------------
 * Voice selection — pick the most natural-sounding browser voice available.
 *
 * The catalog varies wildly across OS + browser combinations. Chrome ships a
 * set of Google neural voices, Edge exposes the Microsoft *Neural* voices
 * (Aria, Guy, Jenny, …) which are the best-sounding available anywhere in a
 * plain browser, and Safari on macOS/iOS has Apple's own "Enhanced" and
 * "Premium" voices (Samantha, Ava, Alex). We rank by known-good names first,
 * then by generic quality signals (localService === false is often a cloud
 * neural voice), then fall back to any en-* voice.
 *
 * For truly studio-quality voice, set `ELEVENLABS_API_KEY` on the backend
 * and the provider automatically switches to the server-TTS path.
 * -------------------------------------------------------------------------- */

const HIGH_QUALITY_NAME_PATTERNS: RegExp[] = [
  // Microsoft neural voices (Edge on Windows/macOS) — the best free option.
  /Microsoft.*(Aria|Jenny|Guy|Davis|Andrew|Ava|Emma|Brian|Ryan|Sonia).*Neural/i,
  /Microsoft.*Neural/i,
  // Google neural voices in Chrome.
  /Google\s+(UK|US)\s+English/i,
  /Google\s+English/i,
  // Apple enhanced/premium voices.
  /(Samantha|Ava|Alex|Karen|Daniel|Serena|Moira|Tessa|Fiona)\s*\((Enhanced|Premium)\)/i,
  /(Samantha|Ava|Alex|Karen|Daniel|Serena)/i,
];

function scoreVoice(v: SpeechSynthesisVoice): number {
  if (!/^en(-|_|$)/i.test(v.lang)) return -1; // must be English
  let score = 0;
  for (let i = 0; i < HIGH_QUALITY_NAME_PATTERNS.length; i++) {
    if (HIGH_QUALITY_NAME_PATTERNS[i].test(v.name)) {
      // Earlier patterns score higher.
      score += 100 - i * 10;
      break;
    }
  }
  // Cloud voices (localService=false) are usually neural.
  if (!v.localService) score += 15;
  // Slight preference for en-US / en-GB over regional variants.
  if (/^en-(US|GB)$/i.test(v.lang)) score += 3;
  // Default voice as tiebreaker.
  if (v.default) score += 1;
  return score;
}

async function pickNaturalVoice(): Promise<SpeechSynthesisVoice | null> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }
  const synth = window.speechSynthesis;

  const readyVoices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const immediate = synth.getVoices();
    if (immediate.length > 0) return resolve(immediate);
    // Chrome fires `voiceschanged` when the async list arrives. Cap the
    // wait at 500ms so a browser that never fires the event doesn't
    // block startup forever.
    let done = false;
    const handler = () => {
      if (done) return;
      done = true;
      synth.removeEventListener?.("voiceschanged", handler);
      resolve(synth.getVoices());
    };
    synth.addEventListener?.("voiceschanged", handler);
    setTimeout(() => {
      if (!done) {
        done = true;
        resolve(synth.getVoices());
      }
    }, 500);
  });

  if (!readyVoices.length) return null;

  const ranked = readyVoices
    .map((v) => ({ v, score: scoreVoice(v) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.v ?? null;
}
