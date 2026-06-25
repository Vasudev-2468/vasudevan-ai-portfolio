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

  return (
    <Section id="contact" index="07" eyebrow="Contact" title={<>contact</>}>
      <div className="grid gap-10 md:grid-cols-[1.1fr_1fr]">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block text-xs font-medium text-ink-100/70">Name</span>
              <input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Your name"
                className="mt-1 w-full rounded-md border border-ink-100/15 bg-white px-3 py-2 text-sm text-ink-50 outline-none transition focus:border-accent"
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
                className="mt-1 w-full rounded-md border border-ink-100/15 bg-white px-3 py-2 text-sm text-ink-50 outline-none transition focus:border-accent"
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-ink-100/70">Subject (optional)</span>
            <input
              value={form.subject}
              onChange={(e) => set("subject", e.target.value)}
              placeholder="Research collaboration, role inquiry, etc."
              className="mt-1 w-full rounded-md border border-ink-100/15 bg-white px-3 py-2 text-sm text-ink-50 outline-none transition focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-ink-100/70">Message</span>
            <textarea
              required
              rows={6}
              value={form.message}
              onChange={(e) => set("message", e.target.value)}
              placeholder="What would you like to ask or share?"
              className="mt-1 w-full rounded-md border border-ink-100/15 bg-white px-3 py-2 text-sm text-ink-50 outline-none transition focus:border-accent"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={status === "sending"}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {status === "sending" ? "Sending…" : "Send message"}
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
          <p className="text-ink-100/70">
            Open to research collaborations, PhD opportunities, and AI engineering roles.
          </p>
          <a
            href={`mailto:${profile.email}`}
            className="flex items-center justify-between rounded-md border border-ink-100/15 bg-white px-3 py-2 transition hover:border-accent"
          >
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink-100/55">
              email
            </span>
            <span className="font-medium text-ink-50">{profile.email}</span>
          </a>
          <div className="flex items-center justify-between rounded-md border border-ink-100/15 bg-white px-3 py-2">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink-100/55">
              phone
            </span>
            <span className="font-medium text-ink-50">{profile.phone}</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-ink-100/15 bg-white px-3 py-2">
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
                className="rounded-md border border-ink-100/15 bg-white px-3 py-2 text-center font-mono text-[11px] uppercase tracking-widest text-ink-100/75 transition hover:border-accent hover:text-accent"
              >
                {k}↗
              </a>
            ))}
          </div>
        </aside>
      </div>

      <p className="mt-10 text-center font-mono text-[11px] uppercase tracking-widest text-ink-100/35">
        © {new Date().getFullYear()} {profile.name} · Built with Next.js 15 · Three.js · FastAPI ·{" "}
        <a href="/admin" className="hover:text-accent">admin</a>
      </p>
    </Section>
  );
}
