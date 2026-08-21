"use client";

import { useState } from "react";
import Section from "./Section";
import { api } from "@/lib/api";
import type { Profile } from "@/lib/api";

type Status = "idle" | "sending" | "sent" | "error";

export default function Contact({ profile }: { profile: Profile }) {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    let session_id: string | undefined;
    try {
      session_id = localStorage.getItem("vasudevan-visit-sid") ?? undefined;
    } catch {
      session_id = undefined;
    }
    const res = await api.sendContact({
      name: form.name.trim(),
      email: form.email.trim(),
      subject: form.subject.trim() || undefined,
      message: form.message.trim(),
      session_id,
    });
    if (res?.ok) {
      setStatus("sent");
      setForm({ name: "", email: "", subject: "", message: "" });
    } else {
      setStatus("error");
      setError("Couldn't send right now — please email me directly.");
    }
  }

  const inputCls =
    "mt-1 w-full rounded-xl border border-ink-100/15 bg-ink-950/40 px-3 py-2.5 text-sm text-ink-50 outline-none transition backdrop-blur placeholder:text-ink-100/40 focus:border-accent/60 focus:bg-ink-950/60";

  return (
    <Section id="contact" index="09" eyebrow="Contact" title={<>future collaboration</>}
      intro="Research collaborations, PhD opportunities, and AI engineering roles — the shortest path is via email or the form below.">
      <div className="grid gap-10 md:grid-cols-[1.1fr_1fr]">
        <form onSubmit={submit} className="glass rounded-3xl p-6 md:p-8">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block text-xs font-medium text-ink-100/70">Name</span>
              <input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Your name"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-ink-100/70">Email</span>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="you@domain.com"
                className={inputCls}
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="block text-xs font-medium text-ink-100/70">Subject (optional)</span>
            <input
              value={form.subject}
              onChange={(e) => set("subject", e.target.value)}
              placeholder="Research collaboration, role inquiry, etc."
              className={inputCls}
            />
          </label>
          <label className="mt-3 block">
            <span className="block text-xs font-medium text-ink-100/70">Message</span>
            <textarea
              required
              rows={6}
              value={form.message}
              onChange={(e) => set("message", e.target.value)}
              placeholder="What would you like to ask or share?"
              className={inputCls}
            />
          </label>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={status === "sending"}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              data-cursor="hover"
            >
              {status === "sending" ? "Sending…" : "Send message"}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {status === "sent" && (
              <span className="text-xs text-accent">Thanks — I&apos;ll reply soon.</span>
            )}
            {status === "error" && error && (
              <span className="text-xs text-rose">{error}</span>
            )}
          </div>
        </form>

        <aside className="space-y-3 text-sm">
          <a
            href={`mailto:${profile.email}`}
            className="glass card-lift flex items-center justify-between rounded-xl px-4 py-3"
            data-cursor="hover"
          >
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink-100/55">
              email
            </span>
            <span className="font-medium text-ink-50">{profile.email}</span>
          </a>
          <div className="glass flex items-center justify-between rounded-xl px-4 py-3">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink-100/55">
              phone
            </span>
            <span className="font-medium text-ink-50">{profile.phone}</span>
          </div>
          <div className="glass flex items-center justify-between rounded-xl px-4 py-3">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink-100/55">
              location
            </span>
            <span className="font-medium text-ink-50">{profile.location}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {Object.entries(profile.links).map(([k, url]) => (
              <a
                key={k}
                href={url}
                target="_blank"
                rel="noreferrer"
                data-cursor="hover"
                className="glass card-lift rounded-xl px-3 py-2 text-center font-mono text-[11px] uppercase tracking-widest text-ink-100/75 transition hover:text-accent"
              >
                {k}↗
              </a>
            ))}
          </div>
        </aside>
      </div>

      <div className="section-divider mt-16" />
      <p className="mt-6 text-center font-mono text-[11px] uppercase tracking-widest text-ink-100/40">
        © {new Date().getFullYear()} {profile.name} · Next.js 15 · React 19 · Three.js · FastAPI ·{" "}
        <a href="/admin" className="hover:text-accent">admin</a>
      </p>
    </Section>
  );
}
