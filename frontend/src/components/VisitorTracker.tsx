"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";

const SESSION_KEY = "vasudevan-visit-sid";

function getOrCreateSession(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const sid = `s-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    localStorage.setItem(SESSION_KEY, sid);
    return sid;
  } catch {
    return `s-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export default function VisitorTracker() {
  useEffect(() => {
    const session_id = getOrCreateSession();

    // 1. Page view
    api.trackView({
      path: window.location.pathname + window.location.search,
      referrer: document.referrer || undefined,
      session_id,
    });

    // 2. Downloads — intercept clicks on [data-track-download]
    function onClick(ev: MouseEvent) {
      const target = ev.target as HTMLElement | null;
      const anchor = target?.closest<HTMLAnchorElement>("a[data-track-download]");
      if (!anchor) return;
      const resource = anchor.getAttribute("data-track-download") || "unknown";
      // Fire-and-forget; don't block the click
      api.trackDownload({
        resource,
        path: anchor.getAttribute("href") || undefined,
        session_id,
      });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
