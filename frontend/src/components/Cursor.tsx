"use client";

import { useEffect, useRef } from "react";

export default function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const dot = dotRef.current!;
    const ring = ringRef.current!;
    let dx = 0, dy = 0, rx = 0, ry = 0;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      dx = e.clientX;
      dy = e.clientY;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const tick = () => {
      raf = 0;
      rx += (dx - rx) * 0.18;
      ry += (dy - ry) * 0.18;
      dot.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate3d(-50%, -50%, 0)`;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate3d(-50%, -50%, 0)`;
      if (Math.abs(dx - rx) > 0.1 || Math.abs(dy - ry) > 0.1) {
        raf = requestAnimationFrame(tick);
      }
    };

    const SELECTOR = 'a, button, [data-cursor="hover"], input, textarea';
    const onOver = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(SELECTOR)) ring.classList.add("is-active");
    };
    const onOut = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(SELECTOR)) ring.classList.remove("is-active");
    };

    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={ringRef} className="cursor-ring" aria-hidden />
      <div ref={dotRef} className="cursor-dot" aria-hidden />
    </>
  );
}
