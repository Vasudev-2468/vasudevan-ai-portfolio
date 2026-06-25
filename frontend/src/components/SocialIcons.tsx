"use client";

type IconKey = "github" | "scholar" | "scopus" | "kaggle" | "email" | "orcid" | "linkedin";

const PATHS: Record<IconKey, string> = {
  github:
    "M12 .5C5.73.5.78 5.45.78 11.72c0 4.93 3.2 9.11 7.64 10.59.56.1.76-.24.76-.54v-2.1c-3.1.67-3.76-1.32-3.76-1.32-.51-1.29-1.24-1.63-1.24-1.63-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15.99 1.7 2.61 1.21 3.25.92.1-.72.39-1.21.71-1.49-2.47-.28-5.07-1.24-5.07-5.5 0-1.22.43-2.22 1.14-3-.11-.28-.5-1.43.11-2.98 0 0 .94-.3 3.08 1.14a10.6 10.6 0 015.6 0c2.14-1.44 3.08-1.14 3.08-1.14.61 1.55.23 2.7.11 2.98.71.78 1.14 1.78 1.14 3 0 4.27-2.61 5.21-5.09 5.49.4.35.76 1.04.76 2.1v3.11c0 .3.2.65.77.54 4.43-1.48 7.62-5.66 7.62-10.58C23.22 5.45 18.27.5 12 .5z",
  scholar:
    "M12 3L1 9l11 6 9-4.91V17h2V9L12 3zm0 14.5L5 13.66v2.43L12 20l7-3.91v-2.43L12 17.5z",
  scopus:
    "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z",
  kaggle:
    "M4.5 2v20h2.7v-7l1.5-1.4 5 8.4H17l-6.4-10.6L17 4h-3.6l-6.2 7V2H4.5z",
  email:
    "M2 4h20v16H2V4zm10 9L4 5v.01L12 13l8-7.99V5l-8 8z",
  orcid:
    "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zM7.4 17.7H5.6V7.5h1.8v10.2zm-.9-11.5c-.6 0-1.1-.5-1.1-1.1S5.9 4 6.5 4s1.1.5 1.1 1.1-.5 1.1-1.1 1.1zM18.4 17.7h-4.8V7.5h4.8c2.8 0 4.2 2.1 4.2 5.1 0 3.3-1.9 5.1-4.2 5.1zm-.3-8.4h-2.7v6.7h2.7c1.9 0 2.8-1.3 2.8-3.3 0-2.1-1-3.4-2.8-3.4z",
  linkedin:
    "M19 0H5a5 5 0 00-5 5v14a5 5 0 005 5h14a5 5 0 005-5V5a5 5 0 00-5-5zM8 19H5V8h3v11zM6.5 6.7C5.5 6.7 4.8 6 4.8 5s.7-1.7 1.7-1.7S8.2 4 8.2 5s-.7 1.7-1.7 1.7zM20 19h-3v-5.6c0-1.4-.5-2.3-1.7-2.3-.9 0-1.5.6-1.7 1.2-.1.2-.1.5-.1.8V19h-3V8h3v1.3a3 3 0 012.7-1.5c2 0 3.5 1.3 3.5 4.1V19z",
};

const LABEL: Record<IconKey, string> = {
  github: "GitHub",
  scholar: "Google Scholar",
  scopus: "Scopus",
  kaggle: "Kaggle",
  email: "Email",
  orcid: "ORCID",
  linkedin: "LinkedIn",
};

function isIconKey(k: string): k is IconKey {
  return k in PATHS;
}

export default function SocialIcons({
  links,
  email,
  className,
}: {
  links: Record<string, string>;
  email?: string;
  className?: string;
}) {
  const entries: Array<[IconKey, string]> = [];
  if (email) entries.push(["email", `mailto:${email}`]);
  for (const [k, url] of Object.entries(links)) {
    const key = k.toLowerCase();
    if (isIconKey(key)) entries.push([key, url]);
  }

  return (
    <ul className={`flex flex-wrap items-center gap-3 ${className ?? ""}`}>
      {entries.map(([key, url]) => (
        <li key={key}>
          <a
            href={url}
            target={url.startsWith("mailto:") ? undefined : "_blank"}
            rel={url.startsWith("mailto:") ? undefined : "noreferrer"}
            aria-label={LABEL[key]}
            title={LABEL[key]}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-100/15 text-ink-100/70 transition hover:border-accent hover:text-accent"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
              <path d={PATHS[key]} />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
