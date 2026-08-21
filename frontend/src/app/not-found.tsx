/**
 * 404 route. Rendered when no other route matches. Kept in-brand with
 * the same gradient / mono typography language as the rest of the site.
 */

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-accent/80">
        404 · signal lost
      </span>
      <h1 className="font-display text-display-lg text-gradient-accent">
        this route doesn&apos;t exist
      </h1>
      <p className="text-sm text-ink-100/70">
        The page you&apos;re looking for isn&apos;t here — try the home page
        or open the 3D map to explore the site.
      </p>
      <div className="flex gap-3">
        <a
          href="/"
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-ink-950 transition hover:bg-accent-soft"
        >
          Go home
        </a>
        <a
          href="/explore"
          className="rounded-full border border-ink-100/20 px-5 py-2 text-sm text-ink-50 transition hover:border-accent/50 hover:text-accent"
        >
          3D explore
        </a>
      </div>
    </main>
  );
}
