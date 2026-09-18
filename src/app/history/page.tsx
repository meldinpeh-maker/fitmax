"use client";

import { useEffect, useMemo, useState } from "react";
import { workoutStore, prFor, volume, exportAll, importAll, type Workout } from "@/lib/db";

function monthMatrix(year: number, month: number, active: Set<string>) {
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push(key);
  }
  return { cells, active };
}

export default function HistoryPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  useEffect(() => {
    workoutStore.all().then(setWorkouts);
  }, []);

  const activeDays = useMemo(() => new Set(workouts.map((w) => w.date)), [workouts]);
  const byDate = useMemo(() => {
    const m = new Map<string, Workout[]>();
    workouts.forEach((w) => m.set(w.date, [...(m.get(w.date) ?? []), w]));
    return m;
  }, [workouts]);

  const { cells } = monthMatrix(cursor.y, cursor.m, activeDays);
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const prs = useMemo(() => {
    const best = new Map<string, { weight: number; date: string }>();
    for (const w of workouts) {
      for (const s of w.sets) {
        if (s.weightLb == null) continue;
        const cur = best.get(s.exercise);
        if (!cur || s.weightLb > cur.weight) best.set(s.exercise, { weight: s.weightLb, date: w.date });
      }
    }
    return [...best.entries()].sort((a, b) => b[1].weight - a[1].weight);
  }, [workouts]);

  const totalVolume = workouts.reduce((a, w) => a + volume(w), 0);
  const streak = useMemo(() => {
    let s = 0;
    const d = new Date();
    for (;;) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (activeDays.has(key)) s++;
      else if (s > 0 || d < new Date(workouts[0]?.date ?? key)) break;
      else if (s === 0 && key !== workouts[workouts.length - 1]?.date) {
        // allow today to be unlogged without breaking streak
      }
      d.setDate(d.getDate() - 1);
      if (s > 400) break;
    }
    return s;
  }, [activeDays, workouts]);

  async function download() {
    const json = await exportAll();
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fitmax-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      await importAll(await f.text());
      setWorkouts(await workoutStore.all());
      setImportMsg("✓ Imported");
    } catch {
      setImportMsg("Not a FITMAX export file");
    }
  }

  return (
    <div>
      <h1>History 📊</h1>
      <p className="sub">{workouts.length} workouts · {totalVolume.toLocaleString()} lbs moved all-time</p>

      <div className="card">
        <div className="row">
          <button className="btn" style={{ padding: "8px 12px" }} onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}>
            ‹
          </button>
          <b className="grow" style={{ textAlign: "center" }}>{monthLabel}</b>
          <button className="btn" style={{ padding: "8px 12px" }} onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}>
            ›
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginTop: 12 }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="hint" style={{ textAlign: "center" }}>{d}</div>
          ))}
          {cells.map((key, i) => {
            if (!key) return <div key={`x${i}`} />;
            const dayNum = parseInt(key.slice(-2), 10);
            const active = activeDays.has(key);
            const count = byDate.get(key)?.length ?? 0;
            return (
              <div
                key={key}
                style={{
                  aspectRatio: "1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: active ? 900 : 500,
                  color: active ? "#06210b" : "var(--text2)",
                  background: active
                    ? count > 1
                      ? "linear-gradient(135deg, var(--neon), var(--neon2))"
                      : "var(--neon)"
                    : "var(--card2)",
                  border: "1px solid var(--line)",
                }}
                title={active ? `${count} workout${count > 1 ? "s" : ""}` : undefined}
              >
                {dayNum}
              </div>
            );
          })}
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>
          🔥 Streak: <b>{streak}</b> day{streak === 1 ? "" : "s"} — green days are logged workouts.
        </p>
      </div>

      <h2>Personal records</h2>
      {prs.length === 0 && <div className="empty">Log weighted sets and your PRs show up here.</div>}
      {prs.slice(0, 8).map(([name, rec]) => (
        <div className="card" key={name} style={{ padding: "10px 14px" }}>
          <b>{name}</b>
          <span style={{ float: "right", color: "var(--neon)", fontWeight: 900 }}>{rec.weight} lb</span>
          <span className="hint" style={{ display: "block", marginTop: 2 }}>set {rec.date}</span>
        </div>
      ))}

      <h2>All workouts</h2>
      {workouts.length === 0 && <div className="empty">No workouts yet — your history builds itself as you log.</div>}
      {[...workouts]
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
        .map((w) => (
          <div className="card" key={w.id} onClick={() => setOpenId(openId === w.id ? null : w.id)}>
            <div className="row">
              <b>{w.name}</b>
              <span className="hint" style={{ marginLeft: "auto" }}>{w.date}</span>
            </div>
            <span className="hint">
              {w.sets.length} sets · {volume(w).toLocaleString()} lbs{w.durationMin ? ` · ${w.durationMin} min` : ""}
            </span>
            {openId === w.id && (
              <div style={{ marginTop: 8 }}>
                <div className="divider" />
                {w.sets.map((s, i) => {
                  const pr = prFor(workouts, s.exercise);
                  const isPR = s.weightLb != null && pr != null && s.weightLb >= pr;
                  return (
                    <p className="hint" key={i} style={{ margin: "4px 0" }}>
                      {s.exercise} — <b style={{ color: "var(--text)" }}>{s.reps} reps{s.weightLb != null ? ` @ ${s.weightLb} lb` : ""}</b>
                      {isPR && <span className="pr-badge">PR</span>}
                    </p>
                  );
                })}
                {w.note && <p className="hint" style={{ marginBottom: 0 }}>“{w.note}”</p>}
              </div>
            )}
          </div>
        ))}

      <h2>Data</h2>
      <div className="card">
        <p className="hint" style={{ marginTop: 0 }}>
          Everything lives on this device. Export a JSON file to back up or move to another phone.
        </p>
        <div className="row">
          <button className="btn grow" onClick={download}>⬇ Export JSON</button>
          <label className="btn grow" style={{ textAlign: "center" }}>
            ⬆ Import
            <input type="file" accept="application/json" style={{ display: "none" }} onChange={upload} />
          </label>
        </div>
        {importMsg && <p className="hint mt8">{importMsg}</p>}
      </div>
    </div>
  );
}
