"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  auth,
  type AdminSessionInfo,
  type AuthedUserInfo,
  type TwoFASetupResponse,
} from "@/lib/admin";

export default function AccountPanel({
  user,
  onUserChanged,
}: {
  user: AuthedUserInfo;
  onUserChanged: () => Promise<void>;
}) {
  const router = useRouter();
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await auth.logout();
    } catch {
      /* swallow — still redirect below */
    }
    router.replace("/admin/login");
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-ink-50">Account</h3>
          <p className="font-mono text-[11px] text-ink-100/55">
            {user.email} · 2FA {user.totp_enabled ? "on" : "off"}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={signOut}
          className="rounded-full border border-rose/40 px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest text-rose transition hover:bg-rose/10 disabled:opacity-40"
        >
          Sign out
        </button>
      </div>

      {flash && (
        <p
          className={`mb-3 font-mono text-[11px] ${
            flash.tone === "ok" ? "text-accent" : "text-rose"
          }`}
        >
          {flash.msg}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <PasswordForm setFlash={setFlash} />
        <TwoFASection user={user} onChanged={onUserChanged} setFlash={setFlash} />
      </div>

      <SessionsSection setFlash={setFlash} />
    </div>
  );
}

// ── Sessions (active devices) ───────────────────────────────────────────

function SessionsSection({
  setFlash,
}: {
  setFlash: (f: { tone: "ok" | "err"; msg: string } | null) => void;
}) {
  const router = useRouter();
  const [sessions, setSessions] = useState<AdminSessionInfo[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSessions(await auth.listSessions());
    } catch (ex) {
      setFlash({ tone: "err", msg: (ex as Error).message });
    }
  }, [setFlash]);

  useEffect(() => {
    load();
  }, [load]);

  async function revoke(sid: string, self: boolean) {
    if (self && !confirm("Revoke this device? You'll be signed out.")) return;
    setBusy(true);
    try {
      await auth.revokeSession(sid);
      if (self) {
        router.replace("/admin/login");
        return;
      }
      setFlash({ tone: "ok", msg: "session revoked" });
      await load();
    } catch (ex) {
      setFlash({ tone: "err", msg: (ex as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function revokeOthers() {
    if (!confirm("Revoke every other signed-in device?")) return;
    setBusy(true);
    try {
      const res = await auth.revokeOtherSessions();
      setFlash({ tone: "ok", msg: `revoked ${res.revoked} other session${res.revoked === 1 ? "" : "s"}` });
      await load();
    } catch (ex) {
      setFlash({ tone: "err", msg: (ex as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-ink-100/10 bg-white/40 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-medium text-ink-50">Active sessions</h4>
        <span className="font-mono text-[11px] text-ink-100/55">
          {sessions.length} device{sessions.length === 1 ? "" : "s"}
        </span>
      </div>
      {sessions.length === 0 ? (
        <p className="text-xs text-ink-100/55">No active sessions.</p>
      ) : (
        <>
          <ul className="divide-y divide-ink-100/10">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="text-xs text-ink-50">
                    {s.is_current && (
                      <span className="mr-2 rounded-full border border-accent/60 px-2 py-px font-mono text-[10px] uppercase tracking-widest text-accent">
                        this device
                      </span>
                    )}
                    {s.ip ?? "—"} · <span className="text-ink-100/55">{fmtWhen(s.last_seen)}</span>
                  </p>
                  <p className="truncate font-mono text-[10px] text-ink-100/55" title={s.user_agent ?? ""}>
                    {(s.user_agent ?? "").slice(0, 90)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => revoke(s.id, s.is_current)}
                  className="rounded-full border border-rose/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-rose hover:bg-rose/10 disabled:opacity-40"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
          {sessions.length > 1 && (
            <button
              type="button"
              disabled={busy}
              onClick={revokeOthers}
              className="mt-3 rounded-full border border-rose/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-rose hover:bg-rose/10 disabled:opacity-40"
            >
              Sign out all other devices
            </button>
          )}
        </>
      )}
    </div>
  );
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ── Password change ─────────────────────────────────────────────────────

function PasswordForm({
  setFlash,
}: {
  setFlash: (f: { tone: "ok" | "err"; msg: string } | null) => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setFlash({ tone: "err", msg: "new passwords don't match" });
      return;
    }
    setBusy(true);
    try {
      await auth.changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setFlash({ tone: "ok", msg: "password changed" });
    } catch (ex) {
      setFlash({ tone: "err", msg: (ex as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-ink-100/10 bg-white/40 p-4">
      <h4 className="mb-3 text-sm font-medium text-ink-50">Change password</h4>
      <label className="mb-2 block">
        <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-100/55">
          Current password
        </span>
        <input
          type="password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="w-full rounded-full border border-ink-100/15 bg-white/70 px-3 py-1.5 text-sm text-ink-50 outline-none focus:border-accent/60"
        />
      </label>
      <label className="mb-2 block">
        <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-100/55">
          New password (min 10)
        </span>
        <input
          type="password"
          required
          minLength={10}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="w-full rounded-full border border-ink-100/15 bg-white/70 px-3 py-1.5 text-sm text-ink-50 outline-none focus:border-accent/60"
        />
      </label>
      <label className="mb-3 block">
        <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-100/55">
          Confirm new password
        </span>
        <input
          type="password"
          required
          minLength={10}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-full border border-ink-100/15 bg-white/70 px-3 py-1.5 text-sm text-ink-50 outline-none focus:border-accent/60"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white transition hover:bg-accent-soft disabled:opacity-40"
      >
        {busy ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}

// ── 2FA ─────────────────────────────────────────────────────────────────

function TwoFASection({
  user,
  onChanged,
  setFlash,
}: {
  user: AuthedUserInfo;
  onChanged: () => Promise<void>;
  setFlash: (f: { tone: "ok" | "err"; msg: string } | null) => void;
}) {
  const [pending, setPending] = useState<TwoFASetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePwd, setDisablePwd] = useState("");
  const [disableCode, setDisableCode] = useState("");

  async function beginEnable() {
    setBusy(true);
    try {
      const s = await auth.setup2fa();
      setPending(s);
      setFlash(null);
    } catch (ex) {
      setFlash({ tone: "err", msg: (ex as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await auth.enable2fa(code);
      setPending(null);
      setCode("");
      await onChanged();
      setFlash({ tone: "ok", msg: "2FA enabled — save your backup codes" });
    } catch (ex) {
      setFlash({ tone: "err", msg: (ex as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await auth.disable2fa(disablePwd, disableCode);
      setDisableOpen(false);
      setDisablePwd("");
      setDisableCode("");
      await onChanged();
      setFlash({ tone: "ok", msg: "2FA disabled" });
    } catch (ex) {
      setFlash({ tone: "err", msg: (ex as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-ink-100/10 bg-white/40 p-4">
      <h4 className="mb-3 text-sm font-medium text-ink-50">Two-factor auth</h4>

      {user.totp_enabled ? (
        disableOpen ? (
          <form onSubmit={disable} className="space-y-2">
            <p className="text-xs text-ink-100/70">
              Enter your password and a valid TOTP or backup code to disable 2FA.
            </p>
            <input
              type="password"
              required
              placeholder="password"
              value={disablePwd}
              onChange={(e) => setDisablePwd(e.target.value)}
              className="w-full rounded-full border border-ink-100/15 bg-white/70 px-3 py-1.5 text-sm text-ink-50 outline-none focus:border-accent/60"
            />
            <input
              required
              placeholder="6-digit code or backup"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              className="w-full rounded-full border border-ink-100/15 bg-white/70 px-3 py-1.5 text-sm text-ink-50 outline-none focus:border-accent/60"
            />
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={busy || !disablePwd || !disableCode}
                className="rounded-full border border-rose/40 px-4 py-1.5 text-xs text-rose transition hover:bg-rose/10 disabled:opacity-40"
              >
                {busy ? "…" : "Disable 2FA"}
              </button>
              <button
                type="button"
                onClick={() => setDisableOpen(false)}
                className="rounded-full border border-ink-100/15 px-4 py-1.5 text-xs text-ink-100/70"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="mb-3 text-xs text-ink-100/70">
              2FA is active on this account. You&apos;ll be asked for a TOTP code (or
              backup code) on every sign-in.
            </p>
            <button
              type="button"
              onClick={() => setDisableOpen(true)}
              className="rounded-full border border-rose/40 px-4 py-1.5 text-xs text-rose transition hover:bg-rose/10"
            >
              Disable 2FA
            </button>
          </>
        )
      ) : pending ? (
        <form onSubmit={confirmEnable} className="space-y-3">
          <p className="text-xs text-ink-100/70">
            Scan this QR code in Google Authenticator (or paste the secret manually),
            then enter the 6-digit code it shows.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pending.qr_png}
            alt="Scan this QR code with your authenticator app"
            className="mx-auto h-48 w-48 rounded-md bg-white p-2"
          />
          <p className="break-all rounded-md bg-white/70 px-2 py-1 text-center font-mono text-[10px] text-ink-100/75">
            {pending.secret}
          </p>

          <div>
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-rose">
              Save these backup codes now — they won&apos;t be shown again
            </span>
            <ul className="grid grid-cols-2 gap-1 rounded-md bg-white/70 p-2 text-center font-mono text-xs text-ink-50">
              {pending.backup_codes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>

          <input
            required
            autoFocus
            placeholder="6-digit code"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-full border border-ink-100/15 bg-white/70 px-3 py-1.5 text-center font-mono text-sm tracking-widest text-ink-50 outline-none focus:border-accent/60"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || code.length < 6}
              className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              {busy ? "Verifying…" : "Enable 2FA"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPending(null);
                setCode("");
              }}
              className="rounded-full border border-ink-100/15 px-4 py-1.5 text-xs text-ink-100/70"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="mb-3 text-xs text-ink-100/70">
            Add a second factor (TOTP) — Google Authenticator, 1Password, Authy, etc.
            Backup codes are generated and shown once at enable time.
          </p>
          <button
            type="button"
            onClick={beginEnable}
            disabled={busy}
            className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white transition hover:bg-accent-soft disabled:opacity-40"
          >
            {busy ? "Setting up…" : "Enable 2FA"}
          </button>
        </>
      )}
    </div>
  );
}
