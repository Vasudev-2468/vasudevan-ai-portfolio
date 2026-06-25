"use client";

export default function Marquee({
  items,
  reverse = false,
  className = "",
}: {
  items: string[];
  reverse?: boolean;
  className?: string;
}) {
  const row = [...items, ...items];
  return (
    <div
      className={`relative overflow-hidden border-y border-ink-100/10 bg-ink-950/30 py-5 ${className}`}
      aria-hidden
    >
      <div
        className="flex w-max gap-12 will-change-transform"
        style={{ animation: `${reverse ? "marquee 40s linear infinite reverse" : "marquee 40s linear infinite"}` }}
      >
        {row.map((it, i) => (
          <span
            key={i}
            className="font-display text-3xl italic text-ink-100/70 md:text-5xl"
          >
            {it}
            <span className="mx-6 inline-block text-accent">✦</span>
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-ink-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-ink-950 to-transparent" />
    </div>
  );
}
