"use client";

import { useRef, type AnchorHTMLAttributes, type ReactNode } from "react";

/**
 * MagneticButton — a link/button that gently pulls toward the cursor.
 *
 * Uses a small inner translate so the pull is elegant, not gimmicky. Falls
 * back gracefully on touch (no hover events) and reduced motion.
 */

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: "primary" | "ghost";
  children: ReactNode;
  arrow?: boolean;
  strength?: number;
};

export default function MagneticButton({
  variant = "primary",
  children,
  className = "",
  arrow = false,
  strength = 18,
  ...rest
}: Props) {
  const wrap = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);

  function onMove(e: React.MouseEvent<HTMLAnchorElement>) {
    const el = wrap.current;
    const i = inner.current;
    if (!el || !i) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) / r.width;
    const y = (e.clientY - (r.top + r.height / 2)) / r.height;
    i.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
  }
  function onLeave() {
    if (inner.current) inner.current.style.transform = "translate(0, 0)";
  }

  const base = variant === "primary" ? "btn-primary" : "btn-ghost";

  return (
    <a
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`${base} ${className}`}
      data-cursor="hover"
      {...rest}
    >
      <span ref={wrap} className="pointer-events-none inline-flex items-center gap-2">
        <span ref={inner} className="inline-flex items-center gap-2 transition-transform duration-300 ease-out">
          {children}
          {arrow && (
            <svg className="arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </span>
    </a>
  );
}
