"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/admin";

type Step = "credentials" | "2fa";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // If no admin exists yet, kick to /admin/setup.
  useEffect(() => {
    auth
      .status()
      .then((s) => {
        if (s.needs_setup) router.replace("/admin/setup");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await auth.login(email.trim().toLowerCase(), password);
      if ("needs_2fa" in res && res.needs_2fa) {
        setChallenge(res.challenge);
        setStep("2fa");
      } else {
        router.replace("/admin");
      }
    } catch (ex) {
      setError((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit2fa(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await auth.submit2fa(challenge, code);
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
      {step === "credentials" ? (
        <form onSubmit={submitCredentials} className="glass-strong w-full max-w-sm rounded-3xl p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-accent/80">
            // admin · sign in
          </p>
          <h1 className="mt-3 font-display text-3xl">Control room.</h1>

          <label className="mt-6 block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-100/55">
              Email
            </span>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-full border border-ink-100/15 bg-white/70 px-4 py-2 text-sm text-ink-50 outline-none focus:border-accent/60"
            />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-100/55">
              Password
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-full border border-ink-100/15 bg-white/70 px-4 py-2 text-sm text-ink-50 outline-none focus:border-accent/60"
            />
          </label>

          {error && <p className="mt-3 text-xs text-rose">{error}</p>}

          <button
            type="submit"
            disabled={busy || !email || !password}
            className="mt-6 w-full rounded-full bg-accent py-2.5 text-sm font-medium text-white transition hover:bg-accent-soft disabled:opacity-40"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : (
        <form onSubmit={submit2fa} className="glass-strong w-full max-w-sm rounded-3xl p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-accent/80">
            // admin · two-factor
          </p>
          <h1 className="mt-3 font-display text-3xl">Verify.</h1>
          <p className="mt-2 text-sm text-ink-100/70">
            Enter the 6-digit code from your authenticator app, or paste one of your
            backup codes.
          </p>

          <label className="mt-6 block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-100/55">
              Code
            </span>
            <input
              required
              autoFocus
              inputMode="text"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123 456  ·  or  ABCD-EF12"
              className="w-full rounded-full border border-ink-100/15 bg-white/70 px-4 py-2 text-center font-mono text-lg tracking-widest text-ink-50 outline-none focus:border-accent/60"
            />
          </label>

          {error && <p className="mt-3 text-xs text-rose">{error}</p>}

          <button
            type="submit"
            disabled={busy || code.length < 4}
            className="mt-6 w-full rounded-full bg-accent py-2.5 text-sm font-medium text-white transition hover:bg-accent-soft disabled:opacity-40"
          >
            {busy ? "Verifying…" : "Verify"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("credentials");
              setCode("");
              setChallenge("");
              setError(null);
            }}
            className="mt-3 w-full rounded-full border border-ink-100/15 py-2 text-xs text-ink-100/70 transition hover:border-accent/60 hover:text-accent"
          >
            ← use a different account
          </button>
          <p className="mt-4 text-center text-[11px] text-ink-100/55">
            Lost your device? Use one of your{" "}
            <span className="font-mono text-ink-100/75">XXXX-XXXX</span> backup codes above.
            Lost those too? Reset your account via a shell on the server.
          </p>
        </form>
      )}
    </main>
  );
}
