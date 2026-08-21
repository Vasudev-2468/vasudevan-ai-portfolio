"use client";

import { useEffect, useState } from "react";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function useDeviceQuality(): {
  isCoarse: boolean;
  isSmall: boolean;
  quality: "high" | "medium" | "low";
} {
  const [state, setState] = useState({
    isCoarse: false,
    isSmall: false,
    quality: "high" as "high" | "medium" | "low",
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const small = window.matchMedia("(max-width: 768px)").matches;
    const cores = (navigator as { hardwareConcurrency?: number }).hardwareConcurrency ?? 8;
    const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;
    let quality: "high" | "medium" | "low" = "high";
    if (coarse || small) quality = "medium";
    if (cores <= 4 || mem <= 4) quality = "low";
    setState({ isCoarse: coarse, isSmall: small, quality });
  }, []);
  return state;
}
