"use client";

import { useRef, useState } from "react";
import { admin, type AdminProfile } from "@/lib/admin";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/api\/?$/, "") ?? "";

function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Backend returns a path like `/media/profile/xxx.jpg`. Prefix with the
  // API origin when running against a separate host; falls through
  // untouched when they share the origin (rewrite / same-host prod).
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE}${url}`;
}

export default function ProfilePhotoField({
  profile,
  onChanged,
}: {
  profile: AdminProfile | null;
  onChanged: (next: AdminProfile) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const src = resolveUrl(profile?.photo_url);

  async function handleFile(file: File) {
    setError(null);
    if (!ALLOWED.includes(file.type)) {
      setError(`Unsupported type "${file.type}". Use jpg, png, webp, or gif.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.`);
      return;
    }
    setBusy(true);
    try {
      const next = await admin.uploadProfilePhoto(file);
      onChanged(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    if (!profile?.photo_url) return;
    if (
      !window.confirm(
        "Remove profile photo? The public site will fall back to the default avatar.",
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const next = await admin.deleteProfilePhoto();
      onChanged(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`mb-4 rounded-xl border p-4 transition ${
        drag
          ? "border-accent/80 bg-accent/5"
          : "border-ink-100/15 bg-ink-950/30"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={(e) => {
        // Only unset when leaving the outer element, not moving between children.
        if (e.currentTarget === e.target) setDrag(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
    >
      <p className="mb-3 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-widest text-ink-100/55">
        <span>Photo</span>
        <span className="text-ink-100/40">drag &amp; drop or click Upload</span>
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-ink-100/15 bg-ink-950/50">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={profile?.name ? `${profile.name} photo` : "profile photo"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase tracking-widest text-ink-100/45">
              none
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-ink-950 transition hover:bg-accent-soft disabled:opacity-40"
            >
              {busy ? "Uploading…" : src ? "Replace" : "Upload photo"}
            </button>
            {src && (
              <button
                type="button"
                disabled={busy}
                onClick={remove}
                className="rounded-full border border-rose/40 px-4 py-1.5 text-xs text-rose transition hover:bg-rose/10 disabled:opacity-40"
              >
                Remove
              </button>
            )}
          </div>
          <p className="mt-2 font-mono text-[11px] text-ink-100/55">
            jpg / png / webp / gif · max 5&thinsp;MB. The Hero displays a
            240×240 square (object-cover) — upload roughly square, centred
            on the face, for the best crop.
          </p>
          {error && (
            <p className="mt-2 font-mono text-[11px] text-rose">⚠ {error}</p>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        aria-label="profile photo file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
