"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const LINKS = [
  { label: "about", href: "#about", id: "about" },
  { label: "background", href: "#background", id: "background" },
  { label: "experience", href: "#experience", id: "experience" },
  { label: "research", href: "#research", id: "research" },
  { label: "projects", href: "#projects", id: "projects" },
  { label: "skills", href: "#skills", id: "skills" },
  { label: "news", href: "#news", id: "news" },
  { label: "avatar", href: "#avatar", id: "avatar" },
  { label: "assistant", href: "#assistant", id: "assistant" },
  { label: "contact", href: "#contact", id: "contact" },
];

export default function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string>("about");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // IntersectionObserver to track the active section. We keep a
    // running map of {id -> intersectionRatio}; whichever section has
    // the highest ratio inside the active band becomes active. This
    // avoids the "last-entry-wins" flicker when two sections are both
    // partially visible.
    const ratios = new Map<string, number>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          ratios.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        }
        let bestId = "";
        let best = 0;
        for (const [id, r] of ratios) {
          if (r > best) {
            best = r;
            bestId = id;
          }
        }
        if (bestId) setActive(bestId);
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    LINKS.forEach((l) => {
      const el = document.getElementById(l.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? "border-b border-ink-100/10 bg-[rgb(var(--bg)/0.6)] backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-6 px-6 py-3 md:px-10">
        <a href="#top" className="group flex items-center gap-2 font-display text-[15px] tracking-tight text-ink-50" data-cursor="hover">
          <span className="relative flex h-6 w-6 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-accent/20 blur-md" />
            <span className="relative h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_2px_hsl(var(--accent-h)_var(--accent-s)_var(--accent-l)/0.7)]" />
          </span>
          vasudevan<span className="text-accent">.</span>ai
        </a>

        <nav className="hidden items-center justify-center gap-1 text-[13px] text-ink-100/70 md:flex">
          {LINKS.map((l) => {
            const isActive = active === l.id;
            return (
              <a
                key={l.href}
                href={l.href}
                data-cursor="hover"
                aria-current={isActive ? "page" : undefined}
                className="relative rounded-full px-3 py-1.5 transition hover:text-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-accent/12 ring-1 ring-inset ring-accent/30"
                    transition={{ type: "spring", stiffness: 400, damping: 36 }}
                  />
                )}
                <span className={`relative ${isActive ? "text-ink-50" : ""}`}>{l.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 text-[13px] text-ink-100/70">
          <a
            href="/Resume_updated.pdf"
            target="_blank"
            rel="noreferrer"
            data-track-download="resume"
            data-cursor="hover"
            className="hidden items-center gap-1.5 rounded-full border border-ink-100/15 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-ink-100/70 transition hover:border-accent/60 hover:text-accent md:inline-flex"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            cv
          </a>
          <a href="/explore" data-cursor="hover" className="transition hover:text-accent">
            3d
          </a>
          <a
            href="/admin"
            data-cursor="hover"
            className="ml-1 rounded-full border border-accent/50 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-accent transition hover:bg-accent/10"
          >
            admin
          </a>
        </div>
      </div>
    </header>
  );
}
