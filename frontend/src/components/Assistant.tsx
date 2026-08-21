"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Section from "./Section";
import { api } from "@/lib/api";

type Msg = { role: "user" | "assistant"; content: string; sources?: string[] };

const STARTERS = [
  "What is Vasudevan's PhD research?",
  "Show all GI classification projects.",
  "Summarize the Journal Management System.",
  "Which publications cover cybersecurity?",
];

export default function Assistant() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi — I'm Vasudevan's portfolio AI. Ask me about his research, publications, projects, experience, or skills.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId(`web-${Math.random().toString(36).slice(2, 10)}`);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);
    const reply = await api.chat(trimmed, sessionId);
    setLoading(false);
    setMessages((m) => [
      ...m,
      reply
        ? { role: "assistant", content: reply.reply, sources: reply.sources }
        : {
            role: "assistant",
            content: "I couldn't reach the backend just now. Try again in a moment.",
          },
    ]);
  }

  return (
    <Section
      id="assistant"
      index="08"
      eyebrow="AI Assistant"
      title={<>assistant</>}
      intro="Retrieval-grounded answers — every reply cites its source in the portfolio."
    >
      <div className="glass-strong overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between border-b border-ink-100/10 px-5 py-3 font-mono text-[11px] uppercase tracking-widest text-ink-100/55">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-blink rounded-full bg-accent" />
            vasudevan.ai · grounded RAG
          </span>
          <span>session · {sessionId ? sessionId.slice(-6) : "------"}</span>
        </div>

        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-label="AI assistant transcript"
          className="max-h-[460px] space-y-3 overflow-y-auto px-5 py-6"
        >
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-accent text-ink-950"
                    : "border border-ink-100/10 bg-ink-950/60 text-ink-50"
                }`}
              >
                {m.content}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2 border-t border-ink-100/10 pt-2 font-mono text-[11px] uppercase tracking-widest text-ink-100/55">
                    src: {m.sources.join(" · ")}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-ink-100/10 bg-ink-950/60 px-4 py-2 font-mono text-xs text-ink-100/55">
                <span className="inline-block animate-blink">▍</span> thinking
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-ink-100/10 px-5 py-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-ink-100/15 px-3 py-1 text-[11px] text-ink-100/70 transition hover:border-accent/50 hover:text-ink-50"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about Vasudevan's work…"
              className="flex-1 rounded-full border border-ink-100/15 bg-ink-950/50 px-4 py-2.5 text-sm text-ink-50 outline-none transition focus:border-accent/60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-ink-950 transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </Section>
  );
}
