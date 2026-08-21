"use client";

import { motion } from "framer-motion";
import { useState } from "react";

/**
 * VisionPipeline
 *
 * A stylized SVG + Framer Motion visualization of a computer-vision research
 * pipeline. It reads as: image → preprocess → augment → deep model →
 * classification. Fully deterministic — no external assets, no fake metrics.
 */

type Stage = {
  key: string;
  label: string;
  detail: string;
};

const STAGES: Stage[] = [
  { key: "data", label: "Dataset", detail: "Curated medical / GI imagery, class-balanced splits." },
  { key: "pre", label: "Preprocess", detail: "Normalize, resize, denoise, colour-space transforms." },
  { key: "aug", label: "Augment", detail: "Rotation, flip, elastic, cutout — geometry & intensity." },
  { key: "enh", label: "Enhance", detail: "Contrast-limited histogram + fuzzy edge sharpening." },
  { key: "cnn", label: "Deep model", detail: "CNN / ViT backbone with mathematical priors." },
  { key: "cls", label: "Classify", detail: "Softmax head with calibrated confidence bands." },
  { key: "eval", label: "Evaluate", detail: "Precision, recall, ROC-AUC, class-wise F1." },
];

export default function VisionPipeline() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="relative">
      <div className="grid gap-3 md:grid-cols-[repeat(7,minmax(0,1fr))]">
        {STAGES.map((s, i) => {
          const isActive = active === s.key;
          return (
            <motion.button
              key={s.key}
              type="button"
              onMouseEnter={() => setActive(s.key)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(s.key)}
              onBlur={() => setActive(null)}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className={`glass group relative flex flex-col items-start gap-2 rounded-2xl p-4 text-left transition ${isActive ? "border-accent/60" : ""}`}
              data-cursor="hover"
            >
              <span className="font-mono text-[10px] uppercase tracking-widest text-accent/80">
                STAGE {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-display text-base text-ink-50">{s.label}</span>
              <div className="mt-1 h-16 w-full">
                <PipelineGlyph kind={s.key as Stage["key"]} active={isActive} />
              </div>
              <div className="absolute inset-x-3 bottom-3 rounded-lg border border-ink-100/10 bg-ink-950/70 p-2 text-[11px] leading-snug text-ink-100/75 opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100 group-focus:opacity-100">
                {s.detail}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Connecting flow line beneath the grid */}
      <div className="pointer-events-none mt-3 hidden md:block">
        <svg viewBox="0 0 700 20" className="w-full">
          <defs>
            <linearGradient id="pipeflow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--accent-h) var(--accent-s) var(--accent-l))" stopOpacity="0.1" />
              <stop offset="50%" stopColor="hsl(var(--accent-h) var(--accent-s) var(--accent-l))" stopOpacity="0.9" />
              <stop offset="100%" stopColor="rgb(var(--plum))" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <motion.path
            d="M 10 10 Q 350 -6 690 10"
            fill="none"
            stroke="url(#pipeflow)"
            strokeWidth="1.4"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.6, ease: "easeInOut" }}
          />
        </svg>
      </div>
    </div>
  );
}

/* ── Per-stage micro glyph ────────────────────────────────────────────── */

function PipelineGlyph({ kind, active }: { kind: string; active: boolean }) {
  const stroke = active ? "hsl(var(--accent-h) var(--accent-s) var(--accent-l))" : "rgb(var(--ink-400) / 0.7)";
  const fill = active ? "hsl(var(--accent-h) var(--accent-s) var(--accent-l) / 0.15)" : "rgb(var(--ink-400) / 0.06)";
  switch (kind) {
    case "data":
      return (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <rect x="8" y="8" width="24" height="24" rx="2" fill={fill} stroke={stroke} strokeWidth="1" />
          <rect x="32" y="32" width="24" height="24" rx="2" fill={fill} stroke={stroke} strokeWidth="1" />
          <rect x="20" y="20" width="24" height="24" rx="2" fill={fill} stroke={stroke} strokeWidth="1" />
        </svg>
      );
    case "pre":
      return (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <rect x="10" y="10" width="44" height="44" rx="4" fill={fill} stroke={stroke} strokeWidth="1" />
          {Array.from({ length: 4 }).map((_, i) => (
            <line key={i} x1="10" y1={20 + i * 10} x2="54" y2={20 + i * 10} stroke={stroke} strokeOpacity="0.35" />
          ))}
        </svg>
      );
    case "aug":
      return (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <g transform="rotate(-15 32 32)">
            <rect x="12" y="12" width="40" height="40" rx="4" fill={fill} stroke={stroke} strokeWidth="1" />
          </g>
          <g transform="rotate(12 32 32)">
            <rect x="16" y="16" width="32" height="32" rx="3" fill="none" stroke={stroke} strokeOpacity="0.55" strokeDasharray="2 3" />
          </g>
        </svg>
      );
    case "enh":
      return (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <rect x="10" y="10" width="44" height="44" rx="4" fill={fill} stroke={stroke} strokeWidth="1" />
          <path d="M14 44 L26 30 L36 38 L50 18" fill="none" stroke={stroke} strokeWidth="1.4" />
        </svg>
      );
    case "cnn":
      return (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          {[10, 24, 38, 52].map((x) => (
            <g key={x}>
              {[16, 32, 48].map((y) => <circle key={y} cx={x} cy={y} r="2.4" fill={fill} stroke={stroke} />)}
            </g>
          ))}
          {[10, 24, 38].map((x, ci) => (
            <g key={ci}>
              {[16, 32, 48].flatMap((y) =>
                [16, 32, 48].map((y2) => (
                  <line key={`${x}-${y}-${y2}`} x1={x + 2.4} y1={y} x2={x + 14 - 2.4} y2={y2} stroke={stroke} strokeOpacity="0.25" />
                ))
              )}
            </g>
          ))}
        </svg>
      );
    case "cls":
      return (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <rect x="10" y="14" width="44" height="8" rx="4" fill={fill} stroke={stroke} />
          <rect x="10" y="28" width="34" height="8" rx="4" fill={fill} stroke={stroke} />
          <rect x="10" y="42" width="22" height="8" rx="4" fill={fill} stroke={stroke} />
        </svg>
      );
    case "eval":
      return (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <path d="M12 52 L26 34 L36 42 L52 16" fill="none" stroke={stroke} strokeWidth="1.6" />
          <circle cx="26" cy="34" r="2.5" fill={fill} stroke={stroke} />
          <circle cx="36" cy="42" r="2.5" fill={fill} stroke={stroke} />
          <circle cx="52" cy="16" r="2.5" fill={fill} stroke={stroke} />
          <line x1="10" y1="56" x2="56" y2="56" stroke={stroke} strokeOpacity="0.4" />
        </svg>
      );
    default:
      return null;
  }
}
