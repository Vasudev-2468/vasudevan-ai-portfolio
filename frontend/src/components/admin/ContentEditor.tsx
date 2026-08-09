"use client";

import { useEffect, useMemo, useState } from "react";

export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "list" | "select" | "url" | "linkmap";
  placeholder?: string;
  options?: readonly string[];
  span?: 1 | 2; // grid span, default 1
  // Optional hint used for the live char counter under textareas.
  max?: number;
};

type ItemBase = { id: number } & Record<string, unknown>;

// Optional per-row admin actions. Passed as callbacks so the panel doesn't
// have to know which entity API to call — ContentPanels wires them.
export type RowActions<T extends ItemBase> = {
  onPublishToggle?: (item: T, is_public: boolean) => Promise<void>;
  onRestore?: (item: T) => Promise<void>;
  onPurge?: (item: T) => Promise<void>;
  // Positive delta = move down (larger order_index), negative = move up.
  onReorder?: (item: T, delta: 1 | -1) => Promise<void>;
};

// `In` is the payload shape the create/update endpoints accept — usually
// narrower than `Omit<T, "id">` because server-managed columns (version,
// is_public, deleted_at) shouldn't be sent back. Callers can leave it to
// infer from `emptyDraft`.
export type ContentEditorProps<T extends ItemBase, In = Omit<T, "id">> = {
  title: string;
  items: T[];
  fields: FieldDef[];
  emptyDraft: In;
  labelOf: (item: T) => string;
  subtitleOf?: (item: T) => string;
  onCreate: (draft: In) => Promise<void>;
  // `expectedVersion` is the version of the item being edited at load time,
  // so the caller can pass it as an If-Match header for optimistic locking.
  onUpdate: (id: number, draft: In, expectedVersion?: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  singleton?: false;
  // Set true when the list represents trashed items — swaps Delete → Restore
  // and offers a "Purge permanently" action.
  showingTrash?: boolean;
  rowActions?: RowActions<T>;
};

export type ContentEditorSingletonProps<T extends ItemBase, In = Omit<T, "id">> = {
  title: string;
  item: T | null;
  fields: FieldDef[];
  emptyDraft: In;
  onSave: (draft: In) => Promise<void>;
  singleton: true;
};

export default function ContentEditor<T extends ItemBase, In = Omit<T, "id">>(
  props: ContentEditorProps<T, In> | ContentEditorSingletonProps<T, In>,
) {
  if (props.singleton) return <SingletonEditor {...props} />;
  return <ListEditor {...props} />;
}

function SingletonEditor<T extends ItemBase, In>({
  title,
  item,
  fields,
  emptyDraft,
  onSave,
}: ContentEditorSingletonProps<T, In>) {
  const [draft, setDraft] = useState<Record<string, unknown>>(
    (item as Record<string, unknown> | null) ?? (emptyDraft as Record<string, unknown>),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (item) setDraft(item as unknown as Record<string, unknown>);
  }, [item]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await onSave(
        coerceDraft(draft, fields, emptyDraft as Record<string, unknown>) as In,
      );
      setMsg("Saved — assistant will reindex in the background.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-ink-50">{title}</h3>
        {msg && (
          <span className="font-mono text-[11px] text-accent/90">{msg}</span>
        )}
      </div>
      <FormFields fields={fields} draft={draft} setDraft={setDraft} />
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="rounded-full bg-accent px-5 py-2 text-xs font-medium text-ink-950 transition hover:bg-accent-soft disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function ListEditor<T extends ItemBase, In>({
  title,
  items,
  fields,
  emptyDraft,
  labelOf,
  subtitleOf,
  onCreate,
  onUpdate,
  onDelete,
  showingTrash = false,
  rowActions,
}: ContentEditorProps<T, In>) {
  const [openId, setOpenId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>(
    emptyDraft as unknown as Record<string, unknown>,
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Version snapshot captured when the edit form opens, sent as If-Match.
  const [editingVersion, setEditingVersion] = useState<number | undefined>(undefined);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const hay = `${labelOf(it)} ${subtitleOf?.(it) ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, labelOf, subtitleOf]);

  useEffect(() => {
    if (openId === "new") {
      setDraft({ ...(emptyDraft as unknown as Record<string, unknown>) });
      setEditingVersion(undefined);
    } else if (typeof openId === "number") {
      const found = items.find((it) => it.id === openId);
      if (found) {
        setDraft(found as unknown as Record<string, unknown>);
        const v = (found as { version?: unknown }).version;
        setEditingVersion(typeof v === "number" ? v : undefined);
      }
    }
  }, [openId, items, emptyDraft]);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const payload = coerceDraft(
        draft,
        fields,
        emptyDraft as Record<string, unknown>,
      ) as In;
      if (openId === "new") await onCreate(payload);
      else if (typeof openId === "number")
        await onUpdate(openId, payload, editingVersion);
      setOpenId(null);
      setMsg("Saved.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function moveToTrash(id: number) {
    if (!confirm("Move this entry to trash? You can restore it from the Trash tab.")) return;
    setBusy(true);
    try {
      await onDelete(id);
      setOpenId(null);
    } finally {
      setBusy(false);
    }
  }

  async function restore(it: T) {
    if (!rowActions?.onRestore) return;
    setBusy(true);
    try {
      await rowActions.onRestore(it);
    } finally {
      setBusy(false);
    }
  }

  async function purge(it: T) {
    if (!rowActions?.onPurge) return;
    if (
      !confirm(
        `Permanently delete "${labelOf(it)}"? This bypasses the trash and cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    try {
      await rowActions.onPurge(it);
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(it: T) {
    if (!rowActions?.onPublishToggle) return;
    const currentlyPublic =
      (it as { is_public?: unknown }).is_public !== false;
    setBusy(true);
    try {
      await rowActions.onPublishToggle(it, !currentlyPublic);
    } finally {
      setBusy(false);
    }
  }

  async function reorder(it: T, delta: 1 | -1) {
    if (!rowActions?.onReorder) return;
    setBusy(true);
    try {
      await rowActions.onReorder(it, delta);
    } finally {
      setBusy(false);
    }
  }

  const hasOrderIndex = fields.some((f) => f.key === "order_index");

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-ink-50">
          {title}{" "}
          <span className="text-ink-100/55">
            · {query ? `${filteredItems.length} of ${items.length}` : items.length}
            {showingTrash && " (trash)"}
          </span>
        </h3>
        <div className="flex items-center gap-3">
          {items.length > 3 && (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="filter…"
              className="w-40 rounded-full border border-ink-100/15 bg-white/70 px-3 py-1 text-xs text-ink-50 outline-none focus:border-accent/60"
            />
          )}
          {msg && (
            <span className="font-mono text-[11px] text-accent/90">{msg}</span>
          )}
          {!showingTrash && (
            <button
              type="button"
              onClick={() => setOpenId(openId === "new" ? null : "new")}
              className="rounded-full border border-accent/40 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-accent transition hover:bg-accent/10"
            >
              {openId === "new" ? "Cancel" : "+ Add"}
            </button>
          )}
        </div>
      </div>

      {openId === "new" && !showingTrash && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-ink-950/30 p-4">
          <FormFields fields={fields} draft={draft} setDraft={setDraft} />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="rounded-full border border-ink-100/20 px-4 py-1.5 text-xs text-ink-100/70"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-ink-950 disabled:opacity-40"
            >
              {busy ? "Saving…" : "Create"}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && openId !== "new" ? (
        <p className="text-sm text-ink-100/55">
          {showingTrash ? "Trash is empty." : "No entries yet."}
        </p>
      ) : filteredItems.length === 0 ? (
        <p className="text-sm text-ink-100/55">No matches for &ldquo;{query}&rdquo;.</p>
      ) : (
        <ul className="divide-y divide-ink-100/10">
          {filteredItems.map((it, idx) => (
            <li key={it.id} className="py-3">
              {openId === it.id && !showingTrash ? (
                <div className="rounded-xl border border-accent/30 bg-ink-950/30 p-4">
                  <FormFields fields={fields} draft={draft} setDraft={setDraft} />
                  {typeof editingVersion === "number" && (
                    <p className="mt-2 font-mono text-[10px] text-ink-100/45">
                      // version {editingVersion} — a 409 here means another
                      tab saved first. Reload to pick up the newer copy.
                    </p>
                  )}
                  <div className="mt-3 flex justify-between gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => moveToTrash(it.id)}
                      className="rounded-full border border-rose/40 px-3 py-1.5 text-xs text-rose transition hover:bg-rose/10 disabled:opacity-40"
                    >
                      Move to trash
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenId(null)}
                        className="rounded-full border border-ink-100/20 px-4 py-1.5 text-xs text-ink-100/70"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={submit}
                        className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-ink-950 disabled:opacity-40"
                      >
                        {busy ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm text-ink-50">{labelOf(it)}</p>
                      <StatusPill item={it} showingTrash={showingTrash} />
                    </div>
                    {subtitleOf && (
                      <p className="font-mono text-[11px] text-ink-100/55">
                        {subtitleOf(it)}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {hasOrderIndex && rowActions?.onReorder && !showingTrash && (
                      <>
                        <IconBtn
                          label="move up"
                          disabled={busy || idx === 0}
                          onClick={() => reorder(it, -1)}
                        >
                          ↑
                        </IconBtn>
                        <IconBtn
                          label="move down"
                          disabled={busy || idx === filteredItems.length - 1}
                          onClick={() => reorder(it, 1)}
                        >
                          ↓
                        </IconBtn>
                      </>
                    )}
                    {!showingTrash && rowActions?.onPublishToggle && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => togglePublish(it)}
                        className="rounded-full border border-ink-100/20 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-ink-100/75 transition hover:border-accent/60 hover:text-accent disabled:opacity-40"
                      >
                        {(it as { is_public?: unknown }).is_public === false
                          ? "Publish"
                          : "Unpublish"}
                      </button>
                    )}
                    {!showingTrash && (
                      <button
                        type="button"
                        onClick={() => setOpenId(it.id)}
                        className="rounded-full border border-ink-100/20 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-ink-100/75 hover:border-accent/60 hover:text-accent"
                      >
                        Edit
                      </button>
                    )}
                    {showingTrash && rowActions?.onRestore && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => restore(it)}
                        className="rounded-full border border-accent/40 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-accent transition hover:bg-accent/10 disabled:opacity-40"
                      >
                        Restore
                      </button>
                    )}
                    {showingTrash && rowActions?.onPurge && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => purge(it)}
                        className="rounded-full border border-rose/40 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-rose transition hover:bg-rose/10 disabled:opacity-40"
                      >
                        Purge
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IconBtn({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="h-7 w-7 rounded-full border border-ink-100/15 font-mono text-xs text-ink-100/75 transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function StatusPill({
  item,
  showingTrash,
}: {
  item: Record<string, unknown>;
  showingTrash: boolean;
}) {
  if (showingTrash || item.deleted_at) {
    return (
      <span className="rounded-full border border-rose/40 px-2 py-px font-mono text-[10px] uppercase tracking-widest text-rose">
        trashed
      </span>
    );
  }
  if (item.is_public === false) {
    return (
      <span className="rounded-full border border-plum/50 px-2 py-px font-mono text-[10px] uppercase tracking-widest text-plum">
        draft
      </span>
    );
  }
  return (
    <span className="rounded-full border border-accent/40 px-2 py-px font-mono text-[10px] uppercase tracking-widest text-accent/90">
      live
    </span>
  );
}

function FormFields({
  fields,
  draft,
  setDraft,
}: {
  fields: FieldDef[];
  draft: Record<string, unknown>;
  setDraft: (v: Record<string, unknown>) => void;
}) {
  const update = (k: string, v: unknown) => setDraft({ ...draft, [k]: v });

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {fields.map((f) => {
        const val = draft[f.key];
        const wrapCls = f.span === 2 ? "md:col-span-2" : "";
        return (
          <label key={f.key} className={`flex flex-col gap-1 ${wrapCls}`}>
            <span className="flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-100/55">
                {f.label}
              </span>
              {f.type === "textarea" && f.max && (
                <CharCount value={String(val ?? "")} max={f.max} />
              )}
            </span>
            {f.type === "textarea" ? (
              <textarea
                value={String(val ?? "")}
                onChange={(e) => update(f.key, e.target.value)}
                placeholder={f.placeholder}
                rows={4}
                className="rounded-xl border border-ink-100/15 bg-ink-950/50 px-3 py-2 text-sm text-ink-50 outline-none transition focus:border-accent/60"
              />
            ) : f.type === "select" ? (
              <select
                value={String(val ?? "")}
                onChange={(e) => update(f.key, e.target.value)}
                className="rounded-full border border-ink-100/15 bg-ink-950/50 px-3 py-2 text-sm text-ink-50 outline-none focus:border-accent/60"
              >
                {(f.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : f.type === "number" ? (
              <input
                type="number"
                value={val === undefined || val === null ? "" : Number(val)}
                onChange={(e) =>
                  update(f.key, e.target.value === "" ? 0 : Number(e.target.value))
                }
                placeholder={f.placeholder}
                className="rounded-full border border-ink-100/15 bg-ink-950/50 px-3 py-2 text-sm text-ink-50 outline-none focus:border-accent/60"
              />
            ) : f.type === "list" ? (
              <input
                value={
                  Array.isArray(val)
                    ? (val as string[]).join(", ")
                    : String(val ?? "")
                }
                onChange={(e) =>
                  update(
                    f.key,
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                placeholder={f.placeholder ?? "comma-separated"}
                className="rounded-full border border-ink-100/15 bg-ink-950/50 px-3 py-2 text-sm text-ink-50 outline-none focus:border-accent/60"
              />
            ) : f.type === "linkmap" ? (
              <LinkmapEditor
                value={(val ?? {}) as Record<string, string>}
                onChange={(v) => update(f.key, v)}
              />
            ) : f.type === "url" ? (
              <UrlField
                value={String(val ?? "")}
                onChange={(v) => update(f.key, v)}
                placeholder={f.placeholder}
              />
            ) : (
              <input
                type="text"
                value={String(val ?? "")}
                onChange={(e) => update(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="rounded-full border border-ink-100/15 bg-ink-950/50 px-3 py-2 text-sm text-ink-50 outline-none focus:border-accent/60"
              />
            )}
          </label>
        );
      })}
    </div>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  const n = value.length;
  const over = n > max;
  return (
    <span
      className={`font-mono text-[10px] ${over ? "text-rose" : "text-ink-100/50"}`}
    >
      {n} / {max}
    </span>
  );
}

function UrlField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const trimmed = value.trim();
  const looksValid = /^https?:\/\//i.test(trimmed);
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded-full border border-ink-100/15 bg-ink-950/50 px-3 py-2 text-sm text-ink-50 outline-none focus:border-accent/60"
      />
      <a
        href={looksValid ? trimmed : undefined}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="open link in new tab"
        title={looksValid ? "open in new tab" : "enter a valid https:// URL first"}
        className={`h-8 w-8 shrink-0 rounded-full border text-center font-mono text-xs leading-8 ${
          looksValid
            ? "border-accent/40 text-accent hover:bg-accent/10"
            : "pointer-events-none border-ink-100/15 text-ink-100/30"
        }`}
      >
        ↗
      </a>
    </div>
  );
}

function coerceDraft(
  draft: Record<string, unknown>,
  fields: FieldDef[],
  empty: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...empty };
  for (const f of fields) {
    const v = draft[f.key];
    if (f.type === "number") out[f.key] = typeof v === "number" ? v : Number(v ?? 0) || 0;
    else if (f.type === "list") out[f.key] = Array.isArray(v) ? v : [];
    else if (f.type === "linkmap")
      out[f.key] = v && typeof v === "object" && !Array.isArray(v) ? v : {};
    else out[f.key] = v ?? empty[f.key] ?? "";
  }
  // Any key the form doesn't declare is server-managed (photo_url, version,
  // is_public, deleted_at, …) — take it from `draft` so a form save never
  // wipes columns the form never showed. If draft is missing the key, fall
  // back to `empty` for shape safety.
  const fieldKeys = new Set(fields.map((f) => f.key));
  for (const k of Object.keys(empty)) {
    if (fieldKeys.has(k)) continue;
    out[k] = k in draft ? draft[k] : empty[k];
  }
  for (const [k, v] of Object.entries(draft)) {
    if (!fieldKeys.has(k) && !(k in out)) out[k] = v;
  }
  return out;
}

function LinkmapEditor({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  // Work as ordered tuples internally so users can freely rename keys
  // without losing edit position on each keystroke.
  const [rows, setRows] = useState<Array<[string, string]>>(() => Object.entries(value));

  const push = (next: Array<[string, string]>) => {
    setRows(next);
    const obj: Record<string, string> = {};
    for (const [k, v] of next) {
      const key = k.trim();
      if (key) obj[key] = v;
    }
    onChange(obj);
  };

  return (
    <div className="rounded-xl border border-ink-100/15 bg-ink-950/40 p-3">
      {rows.length === 0 ? (
        <p className="mb-2 text-xs text-ink-100/55">No links yet.</p>
      ) : (
        <ul className="mb-2 space-y-1.5">
          {rows.map(([k, v], i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                value={k}
                onChange={(e) => {
                  const next = rows.slice();
                  next[i] = [e.target.value, v];
                  push(next);
                }}
                placeholder="label"
                className="w-28 shrink-0 rounded-full border border-ink-100/15 bg-white/70 px-3 py-1.5 text-xs text-ink-50 outline-none focus:border-accent/60"
              />
              <input
                value={v}
                onChange={(e) => {
                  const next = rows.slice();
                  next[i] = [k, e.target.value];
                  push(next);
                }}
                placeholder="https://…"
                className="flex-1 rounded-full border border-ink-100/15 bg-white/70 px-3 py-1.5 text-xs text-ink-50 outline-none focus:border-accent/60"
              />
              <button
                type="button"
                onClick={() => push(rows.filter((_, j) => j !== i))}
                className="shrink-0 rounded-full border border-rose/40 px-2 py-1 font-mono text-[10px] uppercase text-rose transition hover:bg-rose/10"
                aria-label="remove link"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => push([...rows, ["", ""]])}
        className="rounded-full border border-accent/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-accent transition hover:bg-accent/10"
      >
        + add link
      </button>
    </div>
  );
}
