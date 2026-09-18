"use client";

import { useEffect, useState } from "react";
import { equipmentStore, uid, type Equipment } from "@/lib/db";

const CATEGORIES = ["weights", "bodyweight", "cardio", "misc"];
const EMOJIS = ["🏋️", "🔔", "🧗", "🛏️", "🎗️", "🧘", "🪢", "🚴", "🤸", "🥊", "⚙️", "📦"];

export default function EquipmentPage() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", emoji: "🏋️", category: "weights", weightLb: "", note: "" });

  useEffect(() => {
    equipmentStore.all().then(setItems);
  }, []);

  async function refresh() {
    setItems(await equipmentStore.all());
  }

  async function save() {
    if (!form.name.trim()) return;
    const e: Equipment = {
      id: editing ?? uid(),
      name: form.name.trim(),
      emoji: form.emoji,
      category: form.category,
      weightLb: form.weightLb ? parseFloat(form.weightLb) : null,
      note: form.note.trim(),
      createdAt: Date.now(),
    };
    await equipmentStore.put(e);
    await refresh();
    setAdding(false);
    setEditing(null);
    setForm({ name: "", emoji: "🏋️", category: "weights", weightLb: "", note: "" });
  }

  function startEdit(e: Equipment) {
    setEditing(e.id);
    setAdding(true);
    setForm({ name: e.name, emoji: e.emoji, category: e.category, weightLb: e.weightLb?.toString() ?? "", note: e.note });
  }

  async function remove(id: string) {
    if (!confirm("Remove this from your gear list?")) return;
    await equipmentStore.del(id);
    await refresh();
    setAdding(false);
    setEditing(null);
  }

  return (
    <div>
      <h1>Gear 🏋️</h1>
      <p className="sub">What you have at home — sets you log can pick from this.</p>

      <div className="eq-grid">
        {items.map((e) => (
          <div className="eq-tile" key={e.id} onClick={() => startEdit(e)}>
            <div className="em">{e.emoji}</div>
            <b>{e.name}</b>
            <span>
              {e.weightLb != null ? `up to ${e.weightLb} lb` : CATEGORIES.includes(e.category) ? e.category : ""}
            </span>
          </div>
        ))}
      </div>

      {items.length === 0 && <div className="empty">No gear yet — add what you own below.</div>}

      <button
        className="btn btn-primary btn-full mt12"
        onClick={() => {
          setAdding(!adding);
          setEditing(null);
          setForm({ name: "", emoji: "🏋️", category: "weights", weightLb: "", note: "" });
        }}
      >
        {adding ? "Close" : "+ Add equipment"}
      </button>

      {adding && (
        <div className="card mt12">
          <input
            className="input"
            placeholder="Name (e.g. Adjustable dumbbells)"
            value={form.name}
            onChange={(ev) => setForm({ ...form, name: ev.target.value })}
          />
          <div className="chips mt8">
            {EMOJIS.map((em) => (
              <button
                key={em}
                className={`chip ${form.emoji === em ? "on" : ""}`}
                onClick={() => setForm({ ...form, emoji: em })}
              >
                {em}
              </button>
            ))}
          </div>
          <div className="chips mt8">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                className={`chip ${form.category === c ? "on" : ""}`}
                onClick={() => setForm({ ...form, category: c })}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            className="input mt8"
            type="number"
            inputMode="decimal"
            placeholder="Max weight (lb) — optional"
            value={form.weightLb}
            onChange={(ev) => setForm({ ...form, weightLb: ev.target.value })}
          />
          <input
            className="input mt8"
            placeholder="Note — optional"
            value={form.note}
            onChange={(ev) => setForm({ ...form, note: ev.target.value })}
          />
          <div className="row mt12">
            <button className="btn btn-primary grow" onClick={save} disabled={!form.name.trim()}>
              {editing ? "Save changes" : "Add to gear"}
            </button>
            {editing && (
              <button className="btn btn-danger" onClick={() => remove(editing)}>
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
