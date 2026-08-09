"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/admin";

export default function SetupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Self-lock: if an admin already exists, kick to /admin/login.
  useEffect(() => {
    auth
      .status()
      .then((s) => {
        if (!s.needs_setup) router.replace("/admin/login");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("passwords don't match");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await auth.setup(email.trim().toLowerCase(), password);
      router.replace("/admin");
    } catch (ex) {
      setError((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-xs text-ink-100/55">checking…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="glass-strong w-full max-w-sm rounded-3xl p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-accent/80">
          // admin · first-run setup
        </p>
        <h1 className="mt-3 font-display text-3xl">Create admin.</h1>
        <p className="mt-2 text-sm text-ink-100/70">
          No admin exists yet. Set an email and password to claim this portal.
          This page locks itself after the first user is created.
        </p>

        <label className="mt-6 block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-100/55">
            Email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@domain.com"
            className="w-full rounded-full border border-ink-100/15 bg-white/70 px-4 py-2 text-sm text-ink-50 outline-none focus:border-accent/60"
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-100/55">
            Password (min 10)
          </span>
          <input
            type="password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-full border border-ink-100/15 bg-white/70 px-4 py-2 text-sm text-ink-50 outline-none focus:border-accent/60"
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-100/55">
            Confirm password
          </span>
          <input
            type="password"
            required
            minLength={10}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-full border border-ink-100/15 bg-white/70 px-4 py-2 text-sm text-ink-50 outline-none focus:border-accent/60"
          />
        </label>

        {error && <p className="mt-3 text-xs text-rose">{error}</p>}

        <button
          type="submit"
          disabled={busy || !email || !password || !confirm}
          className="mt-6 w-full rounded-full bg-accent py-2.5 text-sm font-medium text-white transition hover:bg-accent-soft disabled:opacity-40"
        >
          {busy ? "Creating…" : "Create admin"}
        </button>
      </form>
    </main>
  );
}
