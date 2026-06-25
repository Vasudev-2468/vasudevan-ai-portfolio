"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "black" | "white" | "rgb";
export const THEMES: Theme[] = ["white", "black", "rgb"];
export const STORAGE_KEY = "vasudevan-theme";
const DEFAULT_THEME: Theme = "white";

type Ctx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  cycleTheme: () => void;
};

const ThemeContext = createContext<Ctx | null>(null);

function readInitialTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "black" || attr === "white" || attr === "rgb") return attr;
  return DEFAULT_THEME;
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    setThemeState(readInitialTheme());
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore quota / private-mode */
    }
  }, []);

  const cycleTheme = useCallback(() => {
    setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]);
  }, [theme, setTheme]);

  const value = useMemo(() => ({ theme, setTheme, cycleTheme }), [theme, setTheme, cycleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
