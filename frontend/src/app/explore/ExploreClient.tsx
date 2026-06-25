"use client";

import dynamic from "next/dynamic";

const ExploreScene = dynamic(() => import("@/components/ExploreScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-ink-950 font-mono text-xs uppercase tracking-[0.4em] text-accent/70">
      booting 3D environment…
    </div>
  ),
});

export default function ExploreClient() {
  return <ExploreScene />;
}
