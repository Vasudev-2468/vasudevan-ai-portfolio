"use client";

import { useState } from "react";
import { admin, type AdminCustomField, type AdminCustomFieldInput } from "@/lib/admin";

const KINDS = ["text", "markdown", "number", "url", "json"] as const;

const EMPTY: AdminCustomFieldInput = {
  key: "",
  value: "",
  kind: "text",
  description: "",
  is_public: false,
};

export default function CustomFieldsPanel({
  fields,
  onChanged,
}: {
  fields: AdminCustomField[];
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<AdminCustomFieldInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(f: AdminCustomField) {
    setEditingId(f.id);
    setDraft({
      key: f.key,
      value: f.value ?? "",
      kind: f.kind,
      description: f.description ?? "",
      is_public: f.is_public,
    });
    setError(null);
  }

  function startNew() {
    setEditingId("new");
    setDraft(EMPTY);
    setError(null);
  }

  function cancel() {
    setEditingId(null);
    setDraft(EMPTY);
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (editingId === "new") {
        await admin.createCustomField(draft);
      } else if (typeof editingId === "number") {
        await admin.updateCustomField(editingId, draft);
      }
      cancel();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number, key: string) {
    if (!confirm(`Delete custom field "${key}"? This is recorded in the audit log.`)) return;
    setBusy(true);
    try {
      await admin.deleteCustomField(id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-ink-50">
          Custom fields <span className="text-ink-100/55">· {fields.length}</span>
        </h3>
        {editingId === null && (
          <button
            type="button"
            onClick={startNew}
            className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-white transition hover:opacity-90"
          >
            + Add field
          </button>
        )}
      </div>

      {editingId !== null && (
        <FieldForm
          draft={draft}
          busy={busy}
          error={error}
          isNew={editingId === "new"}
          onChange={setDraft}
          onSave={save}
          onCancel={cancel}
        />
      )}

      {fields.length === 0 ? (
        <p className="mt-3 text-sm text-ink-100/55">
          No custom fields yet. Add one above — e.g. <code>office_hours</code> or <code>twitter_handle</code>.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-ink-100/10">
          {fields.map((f) => (
            <li key={f.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-mono text-sm font-medium text-ink-50">
                  {f.key}
                  <span className="ml-2 rounded-full border border-ink-100/15 px-2 py-px text-[11px] uppercase tracking-widest text-ink-100/60">
                    {f.kind}
                  </span>
                  {f.is_public && (
                    <span className="ml-1 rounded-full border border-accent/40 px-2 py-px text-[11px] uppercase tracking-widest text-accent">
                      public
                    </span>
                  )}
                </div>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => startEdit(f)}
                    className="text-accent hover:underline"
                  >
                    edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(f.id, f.key)}
                    className="text-rose hover:underline"
                  >
                    delete
                  </button>
                </div>
              </div>
              {f.description && (
                <p className="mt-1 text-xs italic text-ink-100/65">{f.description}</p>
              )}
              <p className="mt-1 whitespace-pre-wrap break-all text-sm text-ink-100/85">
                {f.value ?? <span className="italic text-ink-100/45">(empty)</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FieldForm({
  draft,
  busy,
  error,
  isNew,
  onChange,
  onSave,
  onCancel,
}: {
  draft: AdminCustomFieldInput;
  busy: boolean;
  error: string | null;
  isNew: boolean;
  onChange: (d: AdminCustomFieldInput) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl border border-ink-100/15 bg-white/60 p-3">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-ink-100/55">
        {isNew ? "// new field" : "// edit field"}
      </p>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          value={draft.key}
          onChange={(e) => onChange({ ...draft, key: e.target.value })}
          placeholder="key (e.g. office_hours)"
          disabled={!isNew}
          className="rounded-md border border-ink-100/15 bg-white px-3 py-2 text-sm text-ink-50 outline-none focus:border-accent disabled:opacity-60"
        />
        <select
          value={draft.kind}
          onChange={(e) => onChange({ ...draft, kind: e.target.value })}
          className="rounded-md border border-ink-100/15 bg-white px-3 py-2 text-sm text-ink-50 outline-none focus:border-accent"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={draft.value ?? ""}
        onChange={(e) => onChange({ ...draft, value: e.target.value })}
        placeholder="value"
        rows={3}
        className="mt-2 w-full rounded-md border border-ink-100/15 bg-white px-3 py-2 text-sm text-ink-50 outline-none focus:border-accent"
      />
      <input
        value={draft.description ?? ""}
        onChange={(e) => onChange({ ...draft, description: e.target.value })}
        placeholder="description (optional)"
        className="mt-2 w-full rounded-md border border-ink-100/15 bg-white px-3 py-2 text-sm text-ink-50 outline-none focus:border-accent"
      />
      <label className="mt-2 inline-flex items-center gap-2 text-xs text-ink-100/75">
        <input
          type="checkbox"
          checked={draft.is_public}
          onChange={(e) => onChange({ ...draft, is_public: e.target.checked })}
        />
        public · exposed via GET /api/custom-fields
      </label>
      {error && <p className="mt-2 text-xs text-rose">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={busy || !draft.key.trim()}
          className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-ink-100/15 px-4 py-1.5 text-xs text-ink-100/75 transition hover:border-rose hover:text-rose"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
