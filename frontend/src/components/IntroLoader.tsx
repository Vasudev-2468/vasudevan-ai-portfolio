"use client";

import { useEffect, useState } from "react";

/**
 * IntroLoader — a short "INITIALIZING AI SYSTEM" reveal that fades out on
 * mount. Intentionally brief so the page isn't delayed for real users.
 */
export default function IntroLoader() {
  const [hidden, setHidden] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const DURATION = 900; // ms — deliberately short

    const step = () => {
      const t = Math.min((performance.now() - start) / DURATION, 1);
      setProgress(t);
      if (t < 1) raf = requestAnimationFrame(step);
      else setHidden(true);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className={`loader-shell ${hidden ? "is-hidden" : ""}`}
      aria-hidden={hidden}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      aria-label="Initializing site"
    >
      <div className="flex flex-col items-center gap-6">
        <div className="relative h-16 w-16">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/30" />
          <span className="absolute inset-2 rounded-full border border-accent/60" />
          <span className="absolute inset-4 rounded-full bg-accent shadow-[0_0_28px_6px_hsl(var(--accent-h)_var(--accent-s)_var(--accent-l)/0.55)]" />
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-ink-100/70">
          initializing ai system
        </p>
        <div className="h-[2px] w-56 overflow-hidden rounded-full bg-ink-100/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent via-plum to-rose"
            style={{ width: `${Math.round(progress * 100)}%`, transition: "width 60ms linear" }}
          />
        </div>
      </div>
    </div>
  );
}
