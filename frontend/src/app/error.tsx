"use client";

/**
 * Route-level error boundary. Catches errors thrown by any child server
 * or client component and renders a controlled UI instead of Next's
 * default overlay. The `reset` prop re-mounts the segment so a transient
 * failure (e.g. backend blip) can be retried without a full reload.
 */

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error to whatever telemetry pipeline is wired later.
    // For now, log in dev.
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[route error]", error);
    }
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-accent/80">
        05 · unexpected error
      </span>
      <h1 className="font-display text-display-md text-gradient-accent">
        something broke on our side
      </h1>
      <p className="text-sm text-ink-100/70">
        This is a transient error — the portfolio is otherwise fine. Try again,
        or return to the home page.
      </p>
      {error.digest && (
        <code className="rounded-lg border border-ink-100/10 bg-ink-950/40 px-3 py-1 font-mono text-[11px] text-ink-100/60">
          ref · {error.digest}
        </code>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-ink-950 transition hover:bg-accent-soft"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-full border border-ink-100/20 px-5 py-2 text-sm text-ink-50 transition hover:border-accent/50 hover:text-accent"
        >
          Go home
        </a>
      </div>
    </main>
  );
}
