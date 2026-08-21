"use client";

import { useRef, type ReactNode } from "react";

const MAX_TILT = 9; // degrees

export default function TiltCard({
  children,
  className = "",
  glowClassName = "",
}: {
  children: ReactNode;
  className?: string;
  glowClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const ry = (px - 0.5) * MAX_TILT * 2;
    const rx = -(py - 0.5) * MAX_TILT * 2;
    el.style.setProperty("--rx", `${rx}deg`);
    el.style.setProperty("--ry", `${ry}deg`);
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
  }

  function reset() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      className={`tilt-card relative ${className}`}
      data-cursor="hover"
    >
      <div className={`tilt-glow pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${glowClassName}`} />
      {children}
    </div>
  );
}
