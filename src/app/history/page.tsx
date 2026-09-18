"use client";

import { useEffect, useMemo, useState } from "react";
import { workoutStore, prFor, volume, exportAll, importAll, todayKey, type Workout } from "@/lib/db";

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

  const first = new Date(cursor.y, cursor.m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: startDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const key = `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
      return key;
    }),
  ];
  const monthLabel = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const today = todayKey();

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
    // if today isn't logged yet, start counting from yesterday
    if (!activeDays.has(todayKey())) d.setDate(d.getDate() - 1);
    for (;;) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (activeDays.has(key)) s++;
      else break;
      d.setDate(d.getDate() - 1);
      if (s > 3650) break;
    }
    return s;
  }, [activeDays]);

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
          <button className="btn" style={{ padding: "8px 14px" }} onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}>
            ‹
          </button>
          <b className="grow" style={{ textAlign: "center", fontSize: 16 }}>{monthLabel}</b>
          <button className="btn" style={{ padding: "8px 14px" }} onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}>
            ›
          </button>
        </div>
        <div className="cal-grid">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={`dow${i}`} className="cal-dow">{d}</div>
          ))}
          {cells.map((key, i) => {
            if (!key) return <div key={`x${i}`} />;
            const dayNum = parseInt(key.slice(-2), 10);
            const active = activeDays.has(key);
            return (
              <div key={key} className={`cal-day ${active ? "on" : ""} ${key === today ? "today" : ""}`} title={active ? "logged workout" : undefined}>
                {dayNum}
              </div>
            );
          })}
        </div>
        <p className="hint" style={{ marginBottom: 0, marginTop: 12 }}>
          🔥 Streak: <b>{streak}</b> day{streak === 1 ? "" : "s"} — glowing days are logged workouts.
        </p>
      </div>

      <h2>Personal records</h2>
      {prs.length === 0 && <div className="empty">Log weighted sets and your PRs show up here.</div>}
      {prs.slice(0, 10).map(([name, rec], i) => (
        <div className="pr-row" key={name}>
          <span className="medal">{["🥇", "🥈", "🥉"][i] ?? "🏅"}</span>
          <div>
            <div className="nm">{name}</div>
            <div className="when">{rec.date}</div>
          </div>
          <span className="wt">{rec.weight} lb</span>
        </div>
      ))}

      <h2>All workouts</h2>
      {workouts.length === 0 && <div className="empty">Nothing yet — your history builds itself as you log.</div>}
      {[...workouts]
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
        .map((w) => (
          <div className="card" key={w.id} onClick={() => setOpenId(openId === w.id ? null : w.id)}>
            <div className="row">
              <b>{w.name}</b>
              <span className="hint" style={{ marginLeft: "auto" }}>{w.date}</span>
            </div>
            <span className="hint">
              {w.sets.length} sets · {volume(w).toLocaleString()} lbs
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
          Everything lives on this device. Export a JSON file to back up or move phones.
        </p>
        <div className="row">
          <button className="btn grow" onClick={download}>⬇ Export</button>
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
