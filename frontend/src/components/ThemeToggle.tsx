"use client";

import { useTheme, type Theme } from "./ThemeProvider";

const LABEL: Record<Theme, string> = {
  black: "Dark",
  white: "Light",
  rgb: "RGB",
};

const NEXT: Record<Theme, Theme> = {
  white: "black",
  black: "rgb",
  rgb: "white",
};

const GLYPH: Record<Theme, string> = {
  white: "☀",
  black: "☾",
  rgb: "✦",
};

export default function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={`Theme: ${LABEL[theme]} — click for ${LABEL[NEXT[theme]]}`}
      title={`Theme: ${LABEL[theme]}`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ink-100/15 text-sm text-ink-100/75 transition hover:border-accent/60 hover:text-accent"
    >
      <span aria-hidden className="theme-dot inline-block leading-none">{GLYPH[theme]}</span>
    </button>
  );
}
