"use client";

/**
 * AIAvatar — flagship "Talk to My AI Avatar" section.
 *
 * Wiring:
 *   1. On first user gesture ("Start Conversation") we resolve an
 *      AvatarProvider from `/api/avatar/session` and initialize its
 *      audio graph. This is the only path browsers allow for
 *      AudioContext creation.
 *   2. STT: browser Web Speech API via VoiceInput. If unsupported we
 *      fall back to text input (always present).
 *   3. LLM: `/api/avatar/chat` — same RAG pipeline as the text
 *      assistant, but with a voice-friendly system prompt.
 *   4. TTS + lip-sync: driven by the provider. BrowserPhotoProvider
 *      uses server ElevenLabs when configured, otherwise browser
 *      speechSynthesis with word-boundary-driven mouth animation.
 *   5. States (idle / listening / thinking / speaking / error) drive
 *      both AvatarStatus and the AvatarViewer visuals.
 */

import Section from "@/components/Section";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, type AvatarSessionConfig } from "@/lib/api";
import { createAvatarProvider } from "@/lib/avatar/AvatarProviderFactory";
import type { AvatarProvider, AvatarState } from "@/lib/avatar/types";
import AvatarControls from "./AvatarControls";
import AvatarStatus from "./AvatarStatus";
import AvatarViewer from "./AvatarViewer";
import Conversation, { type Turn } from "./Conversation";
import SuggestedQuestions from "./SuggestedQuestions";

// The 3D neural stage is loaded only on the client, and only once the
// visitor scrolls into the section — see IntersectionObserver below.
const AvatarStage = dynamic(() => import("@/components/3d/AvatarStage"), {
  ssr: false,
  loading: () => null,
});

const INTRO =
  "Hi! I'm the AI avatar representing Vasudevan's professional portfolio. You can ask me about his experience, projects, research, technical skills, or education. What would you like to know?";

export default function AIAvatar() {
  const [state, setState] = useState<AvatarState>("idle");
  const [mouthLevel, setMouthLevel] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [interim, setInterim] = useState("");
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false);
  const [config, setConfig] = useState<AvatarSessionConfig | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inView, setInView] = useState(false);

  const providerRef = useRef<AvatarProvider | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string>("");
  const sectionRef = useRef<HTMLDivElement>(null);

  // Stable session id for the conversation (persists across the
  // page's lifetime so multi-turn context works).
  useEffect(() => {
    sessionIdRef.current = `avatar-${Math.random().toString(36).slice(2, 10)}`;
  }, []);

  // Lazy-mount the 3D stage only when the section scrolls into view.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: "200px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const photoUrl = useMemo(() => {
    const raw = config?.photo_url ?? "/images/avatar.png";
    // Backend can return `/media/foo.png` (admin uploads); route through
    // Next's image loader unchanged.
    return raw;
  }, [config]);

  // Source the badge from the actual provider instance's `kind` — not
  // the server-side declared kind — so the label never lies about a
  // silent factory downgrade (e.g. `did` config but no adapter yet).
  const providerKind =
    providerRef.current?.kind ?? config?.provider ?? "browser-photo";

  // ----- Session bootstrap ---------------------------------------------------

  const start = useCallback(async () => {
    if (started) return;
    setState("thinking");
    setErrorMsg(null);

    let cfg: AvatarSessionConfig;
    try {
      cfg = await api.avatarSession();
    } catch (err) {
      // Backend unreachable — degrade cleanly to the browser-photo path
      // pointed at the shipped placeholder photo, but surface the fact
      // that server config didn't load so the user isn't puzzled if
      // TTS/avatar features look absent later.
      cfg = {
        provider: "browser-photo",
        photo_url: "/images/avatar.png",
        session_token: null,
        session_url: null,
        voice_id: null,
        tts_available: false,
      };
      if (err instanceof ApiError) {
        setErrorMsg(`Avatar service returned ${err.status}. Using local fallback.`);
      } else {
        setErrorMsg("Avatar service is unreachable. Using local fallback.");
      }
    }
    setConfig(cfg);

    const provider = createAvatarProvider(cfg);
    await provider.init({
      photoUrl: cfg.photo_url ?? "/images/avatar.png",
      voiceId: cfg.voice_id,
      serverTtsAvailable: cfg.tts_available,
    });
    providerRef.current = provider;

    setStarted(true);

    // Introduce ourselves — spoken + transcript in one step.
    await speak(INTRO, { asAssistant: true, sources: [] });
  }, [started]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      providerRef.current?.dispose();
      providerRef.current = null;
    };
  }, []);

  // Toggle mute reflects into the provider.
  useEffect(() => {
    providerRef.current?.setMuted(muted);
  }, [muted]);

  // ----- Chat flow -----------------------------------------------------------

  const speak = useCallback(
    async (
      text: string,
      opts?: { asAssistant?: boolean; sources?: string[] }
    ): Promise<void> => {
      if (!providerRef.current) return;
      if (opts?.asAssistant) {
        setTurns((t) => [
          ...t,
          { role: "assistant", content: text, sources: opts?.sources ?? [] },
        ]);
      }
      setState("speaking");
      const ctrl = new AbortController();
      abortRef.current?.abort();
      abortRef.current = ctrl;
      try {
        await providerRef.current.speak({
          text,
          signal: ctrl.signal,
          onMouthLevel: setMouthLevel,
        });
      } finally {
        setMouthLevel(0);
        // Only clear if this was the current utterance.
        if (abortRef.current === ctrl) {
          abortRef.current = null;
          setState("idle");
        }
      }
    },
    []
  );

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || !started) return;
      setInterim("");
      setErrorMsg(null);
      // Stop any current speech so a follow-up interrupts cleanly.
      providerRef.current?.stop();

      setTurns((t) => [...t, { role: "user", content: q }]);
      setState("thinking");

      try {
        const reply = await api.avatarChat(q, sessionIdRef.current);
        await speak(reply.reply, { asAssistant: true, sources: reply.sources });
      } catch (err) {
        setState("error");
        if (err instanceof ApiError) {
          if (err.status === 429) {
            setErrorMsg(
              "You're asking questions faster than the rate limit — give it a moment and try again."
            );
          } else if (err.status >= 500) {
            setErrorMsg(
              "The backend hit an error. Try again in a moment."
            );
          } else {
            setErrorMsg(err.message);
          }
        } else {
          setErrorMsg("I couldn't reach the backend just now. Please try again.");
        }
      }
    },
    [speak, started]
  );

  const stopSpeaking = useCallback(() => {
    providerRef.current?.stop();
    setMouthLevel(0);
    setState("idle");
  }, []);

  const restart = useCallback(() => {
    stopSpeaking();
    setTurns([]);
    setInterim("");
    setErrorMsg(null);
    sessionIdRef.current = `avatar-${Math.random().toString(36).slice(2, 10)}`;
  }, [stopSpeaking]);

  // ----- Render --------------------------------------------------------------

  return (
    <Section
      id="avatar"
      index="07"
      eyebrow="Talk to My AI Avatar"
      title={<>talk to my ai avatar</>}
      intro="Ask anything about my experience, projects, research, or technical skills — by voice or text. The avatar answers from a retrieval-grounded knowledge base of the portfolio."
    >
      <div ref={sectionRef} className="relative">
        {/* Subtle 3D neural stage sits BEHIND the panel. Mounts only when
            the section scrolls into view, and never on the server. */}
        {inView && (
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
            <AvatarStage active={state === "speaking" || state === "listening"} />
          </div>
        )}

        <div className="glass-strong overflow-hidden rounded-3xl">
          <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[minmax(0,360px)_1fr]">
            {/* Left: the avatar itself */}
            <div className="flex flex-col gap-4">
              <AvatarViewer
                photoUrl={photoUrl}
                state={state}
                mouthLevel={mouthLevel}
                providerKind={providerKind}
              />
              <div className="flex items-center justify-between rounded-2xl border border-ink-100/10 bg-ink-950/40 px-4 py-2.5">
                <AvatarStatus state={state} />
                {config?.tts_available ? (
                  <span className="font-mono text-[10px] uppercase tracking-widest text-accent/80">
                    server voice
                  </span>
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-100/45">
                    browser voice
                  </span>
                )}
              </div>
            </div>

            {/* Right: conversation + controls */}
            <div className="flex min-w-0 flex-col gap-4">
              <AnimatePresence mode="wait">
                {!started ? (
                  <motion.div
                    key="cta"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex h-full flex-col items-start justify-center gap-4 rounded-2xl border border-ink-100/10 bg-ink-950/40 p-6"
                  >
                    <p className="font-display text-2xl text-ink-50">
                      Ask questions about my career and work.
                    </p>
                    <p className="max-w-md text-sm text-ink-100/70">
                      Voice or text — the avatar responds by speaking, grounded in the
                      resume knowledge base. Microphone is used only after you grant
                      permission.
                    </p>
                    <button
                      type="button"
                      onClick={start}
                      data-cursor="hover"
                      className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-ink-950 shadow-[0_0_30px_rgba(125,211,255,0.35)] transition hover:bg-accent-soft"
                    >
                      ▶ Start Conversation
                    </button>
                    <p className="text-[11px] text-ink-100/50">
                      This is an AI avatar representing the portfolio owner. It won't
                      claim to be a live human. Conversations aren't recorded beyond
                      the transcript above.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="live"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-4"
                  >
                    <Conversation turns={turns} interim={interim} />

                    {errorMsg && (
                      <p className="rounded-lg border border-rose/40 bg-rose/10 px-3 py-2 text-xs text-rose">
                        {errorMsg}
                      </p>
                    )}

                    <SuggestedQuestions
                      onPick={(q) => ask(q)}
                      disabled={state === "thinking" || state === "speaking"}
                    />

                    <AvatarControls
                      onSend={(t) => ask(t)}
                      onVoiceStart={() => {
                        setInterim("");
                        setState("listening");
                      }}
                      onVoiceEnd={() =>
                        setState((s) => (s === "listening" ? "idle" : s))
                      }
                      onVoiceInterim={(t) => setInterim(t)}
                      onVoiceError={(m) => {
                        setInterim("");
                        setErrorMsg(m);
                        setState("error");
                      }}
                      onStopSpeaking={stopSpeaking}
                      onToggleMute={() => setMuted((m) => !m)}
                      onClear={restart}
                      muted={muted}
                      speaking={state === "speaking"}
                      disabled={state === "thinking"}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
