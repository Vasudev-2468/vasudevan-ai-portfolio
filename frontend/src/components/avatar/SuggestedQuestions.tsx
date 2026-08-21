"use client";

const SUGGESTIONS = [
  { label: "My AI Skills", q: "What technologies and AI skills do you know?" },
  { label: "My Research", q: "Tell me about your PhD research." },
  { label: "My Projects", q: "Tell me about your AI projects." },
  { label: "My Experience", q: "Walk me through your professional experience." },
  { label: "Computer Vision", q: "Tell me about your Computer Vision experience." },
  { label: "Kvasir / GI", q: "Tell me about your gastrointestinal image classification research." },
  { label: "Publications", q: "What have you published?" },
  { label: "Education", q: "Tell me about your education." },
];

export default function SuggestedQuestions({
  onPick,
  disabled,
}: {
  onPick: (q: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SUGGESTIONS.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => onPick(s.q)}
          disabled={disabled}
          data-cursor="hover"
          className="rounded-full border border-ink-100/15 bg-ink-950/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-100/70 transition hover:border-accent/50 hover:text-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
