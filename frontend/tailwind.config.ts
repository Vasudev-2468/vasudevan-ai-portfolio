import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "rgb(var(--ink-50) / <alpha-value>)",
          100: "rgb(var(--ink-100) / <alpha-value>)",
          400: "rgb(var(--ink-400) / <alpha-value>)",
          500: "rgb(var(--ink-500) / <alpha-value>)",
          600: "rgb(var(--ink-600) / <alpha-value>)",
          900: "rgb(var(--ink-900) / <alpha-value>)",
          950: "rgb(var(--ink-950) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent-h) var(--accent-s) var(--accent-l) / <alpha-value>)",
          soft: "hsl(var(--accent-h) var(--accent-s) calc(var(--accent-l) + 6%) / <alpha-value>)",
          deep: "hsl(var(--accent-h) var(--accent-s) calc(var(--accent-l) - 20%) / <alpha-value>)",
        },
        plum: "rgb(var(--plum) / <alpha-value>)",
        rose: "rgb(var(--rose) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-space)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-instrument)", "serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "display-xl": ["clamp(2.75rem, 8vw, 6.5rem)", { lineHeight: "0.95", letterSpacing: "-0.035em" }],
        "display-lg": ["clamp(2rem, 4.5vw, 3.5rem)", { lineHeight: "1.02", letterSpacing: "-0.025em" }],
        "display-md": ["clamp(1.5rem, 2.6vw, 2.1rem)", { lineHeight: "1.15", letterSpacing: "-0.015em" }],
      },
      boxShadow: {
        glow: "0 0 80px -12px hsl(var(--accent-h) var(--accent-s) var(--accent-l) / 0.45)",
        ring: "0 0 0 1px hsl(var(--accent-h) var(--accent-s) var(--accent-l) / 0.25), 0 0 40px -8px hsl(var(--accent-h) var(--accent-s) var(--accent-l) / 0.35)",
      },
      animation: {
        float: "float 8s ease-in-out infinite",
        shimmer: "shimmer 8s linear infinite",
        marquee: "marquee 40s linear infinite",
        "marquee-reverse": "marquee 40s linear infinite reverse",
        "blink": "blink 1.1s steps(1) infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        blink: {
          "0%, 50%": { opacity: "1" },
          "51%, 100%": { opacity: "0" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
