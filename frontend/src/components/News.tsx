import type { AiNewsItem, Experience, Publication } from "@/lib/api";

type LocalItem = {
  date: string;
  sort: number;
  body: React.ReactNode;
};

function parseMonthYear(value: string): number {
  if (!value || value.toLowerCase() === "current") return Date.now();
  const parts = value.split("/");
  if (parts.length === 2) {
    const [mm, yyyy] = parts.map((n) => parseInt(n, 10));
    if (!Number.isNaN(mm) && !Number.isNaN(yyyy)) return new Date(yyyy, mm - 1, 1).getTime();
  }
  const y = parseInt(value, 10);
  if (!Number.isNaN(y)) return new Date(y, 0, 1).getTime();
  return 0;
}

function formatYear(value: string): string {
  const parts = value.split("/");
  if (parts.length === 2) {
    const [mm, yyyy] = parts;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const m = parseInt(mm, 10);
    if (m >= 1 && m <= 12) return `${monthNames[m - 1]} ${yyyy}`;
  }
  return value;
}

function shortDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

const SOURCE_LABEL: Record<AiNewsItem["source"], string> = {
  arxiv: "arXiv",
  hn: "HN",
  devto: "Dev.to",
};

function sourceLabel(item: AiNewsItem): string {
  return SOURCE_LABEL[item.source] ?? item.source;
}

export default function News({
  publications,
  experience,
  aiFeed,
}: {
  publications: Publication[];
  experience: Experience[];
  aiFeed: AiNewsItem[];
}) {
  const local: LocalItem[] = [
    ...publications.map<LocalItem>((p) => ({
      date: String(p.year),
      sort: new Date(p.year, 11, 1).getTime(),
      body: (
        <>
          <span className="text-ink-100/55">
            {p.kind === "patent" ? "Patent filed" : p.kind === "conference" ? "Conference paper" : "Journal paper"}:
          </span>{" "}
          <span className="text-ink-50">{p.title}</span>
          {p.url && (
            <a
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="ml-2 text-accent/90 hover:underline"
            >
              [pdf]
            </a>
          )}
          {p.doi && (
            <a
              href={`https://doi.org/${p.doi}`}
              target="_blank"
              rel="noreferrer"
              className="ml-2 text-accent/90 hover:underline"
            >
              [doi]
            </a>
          )}
        </>
      ),
    })),
    ...experience.map<LocalItem>((e) => ({
      date: formatYear(e.start_date),
      sort: parseMonthYear(e.start_date),
      body: (
        <>
          <span className="text-ink-100/55">Joined</span>{" "}
          <span className="text-ink-50">{e.company}</span>{" "}
          <span className="text-ink-100/55">as</span>{" "}
          <span className="text-ink-50">{e.role}</span>
          {e.end_date.toLowerCase() === "current" && (
            <span className="ml-2 inline-block rounded-full border border-accent/40 px-2 py-px font-mono text-[11px] uppercase tracking-widest text-accent/90">
              current
            </span>
          )}
        </>
      ),
    })),
  ]
    .sort((a, b) => b.sort - a.sort)
    .slice(0, 6);

  return (
    <section id="news" className="section-anchor relative mx-auto max-w-6xl px-6 py-16 md:px-10">
      <div className="section-divider mb-12" aria-hidden />
      <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.32em] text-accent/80">
        <span className="h-px w-6 bg-accent/50" />
        <span>06</span>
        <span>/</span>
        <span>Signal</span>
      </div>
      <h2 className="mt-4 font-display text-display-md text-gradient-accent">news &amp; live feed</h2>
      <p className="mt-2 text-sm text-ink-100/60">
        Personal milestones on the left, a live feed of AI / ML headlines on the right.{" "}
        <span className="font-mono text-[11px] text-ink-100/45">// refreshes ~4× / day</span>
      </p>

      <div className="mt-8 grid gap-10 md:grid-cols-2">
        <div className="glass rounded-2xl p-6">
          <h3 className="eyebrow">milestones</h3>
          <ol className="mt-3 divide-y divide-ink-100/10 border-t border-ink-100/10">
            {local.map((item, i) => (
              <li key={i} className="grid grid-cols-[78px_1fr] items-baseline gap-3 py-3 text-[14px] leading-relaxed">
                <span className="font-mono text-xs text-ink-100/55">{item.date}</span>
                <span className="text-ink-100/80">{item.body}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="eyebrow">today in AI</h3>
          <ol className="mt-3 divide-y divide-ink-100/10 border-t border-ink-100/10">
            {aiFeed.length === 0 && (
              <li className="py-3 text-sm text-ink-100/55">
                Feed unavailable right now — check back shortly.
              </li>
            )}
            {aiFeed.map((item, i) => (
              <li key={i} className="grid grid-cols-[78px_1fr] items-baseline gap-3 py-3 text-[14px] leading-relaxed">
                <span className="font-mono text-xs text-ink-100/55">{shortDate(item.published_at)}</span>
                <span className="text-ink-100/80">
                  <span className="mr-2 inline-block rounded-full border border-accent/30 px-1.5 py-px font-mono text-[10px] uppercase tracking-widest text-accent/90">
                    {sourceLabel(item)}
                  </span>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink-50 underline-offset-4 hover:text-accent hover:underline"
                  >
                    {item.title}
                  </a>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
