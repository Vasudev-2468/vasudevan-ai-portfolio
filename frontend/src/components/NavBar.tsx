"use client";

const LINKS = [
  ["about", "#about"],
  ["news", "#news"],
  ["publications", "#research"],
  ["projects", "#projects"],
  ["experience", "#experience"],
  ["skills", "#skills"],
  ["assistant", "#assistant"],
  ["contact", "#contact"],
] as const;

export default function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-100/10 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/65">
      <div className="mx-auto grid max-w-5xl grid-cols-[auto_1fr_auto] items-center gap-6 px-6 py-3 md:px-10">
        <a
          href="#top"
          className="font-display text-[15px] tracking-tight text-ink-50"
        >
          vasudevan<span className="text-accent">.</span>ai
        </a>

        <nav className="hidden items-center justify-center gap-x-5 gap-y-1 text-[13px] text-ink-100/70 md:flex md:flex-wrap">
          {LINKS.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="transition hover:text-accent"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 text-[13px] text-ink-100/70">
          <a
            href="/Resume_updated.pdf"
            target="_blank"
            rel="noreferrer"
            data-track-download="resume"
            className="transition hover:text-accent"
          >
            cv
          </a>
          <span aria-hidden className="text-ink-100/25">·</span>
          <a href="/explore" className="transition hover:text-accent">
            3d
          </a>
          <a
            href="/admin"
            className="ml-1 rounded-full border border-accent/50 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-accent transition hover:bg-accent/10"
          >
            admin
          </a>
        </div>
      </div>
    </header>
  );
}
