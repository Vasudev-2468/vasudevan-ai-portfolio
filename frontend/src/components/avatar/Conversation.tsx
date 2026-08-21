"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

export type Turn = {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  pending?: boolean;
};

export default function Conversation({
  turns,
  interim,
}: {
  turns: Turn[];
  interim?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, interim]);

  return (
    <div
      ref={scrollRef}
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      aria-label="Avatar conversation transcript"
      className="max-h-[320px] overflow-y-auto rounded-2xl border border-ink-100/10 bg-ink-950/40 p-4"
    >
      {turns.length === 0 && !interim ? (
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink-100/45">
          transcript · empty
        </p>
      ) : (
        <div className="space-y-3">
          {turns.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  t.role === "user"
                    ? "bg-accent text-ink-950"
                    : "border border-ink-100/10 bg-ink-950/60 text-ink-50"
                } ${t.pending ? "opacity-60" : ""}`}
              >
                {t.content}
                {t.sources && t.sources.length > 0 && (
                  <div className="mt-1.5 border-t border-ink-100/10 pt-1.5 font-mono text-[10px] uppercase tracking-widest text-ink-100/55">
                    src: {t.sources.slice(0, 3).join(" · ")}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {interim && (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl border border-accent/40 bg-accent/10 px-3.5 py-2 text-sm text-ink-50">
                <span className="italic opacity-80">{interim}</span>
                <span className="ml-1 animate-blink">▍</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
