"use client";

import { useEffect, useMemo, useState } from "react";
import {
  equipmentStore,
  workoutStore,
  seedIfEmpty,
  prFor,
  lastSet,
  volume,
  todayKey,
  uid,
  MOVES,
  equipmentForMove,
  type Equipment,
  type SetEntry,
  type Workout,
} from "@/lib/db";

type Draft = SetEntry & { key: string };

const REST_SECONDS = 60;

export default function TodayPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [resting, setResting] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      await seedIfEmpty();
      setEquipment(await equipmentStore.all());
      setWorkouts(await workoutStore.all());
    })();
  }, []);

  // rest timer — auto-stops, buzzes at zero
  useEffect(() => {
    if (resting === null) return;
    const t = setInterval(() => {
      setResting((r) => {
        if (r === null) return null;
        if (r <= 1) {
          try { navigator.vibrate?.(200); } catch {}
          return null;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [resting]);

  const exerciseNames = useMemo(() => {
    const s = new Set<string>(MOVES.map((m) => m.name));
    workouts.forEach((w) => w.sets.forEach((x) => s.add(x.exercise)));
    return [...s];
  }, [workouts]);

  function addMove(moveName: string) {
    const move = MOVES.find((m) => m.name === moveName);
    const eq = move ? equipmentForMove(equipment, move) : null;
    setDrafts((d) => [
      ...d,
      { key: uid(), exercise: moveName, equipmentId: eq?.id ?? null, reps: 10, weightLb: move?.weight ?? eq?.weightLb ?? null },
    ]);
    setResting(REST_SECONDS);
  }

  function addBlank() {
    setDrafts((d) => [...d, { key: uid(), exercise: "", equipmentId: null, reps: 10, weightLb: null }]);
  }

  function patchDraft(key: string, patch: Partial<Draft>) {
    setDrafts((d) => d.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }

  async function saveWorkout() {
    const sets = drafts.filter((d) => d.exercise.trim() && d.reps > 0);
    if (!sets.length) return;
    const w: Workout = {
      id: uid(),
      date: todayKey(),
      name: name.trim() || "Today's workout",
      durationMin: null,
      sets: sets.map(({ key: _k, ...s }) => s as SetEntry),
      note: note.trim(),
      createdAt: Date.now(),
    };
    await workoutStore.put(w);
    setWorkouts(await workoutStore.all());
    setDrafts([]);
    setName("");
    setNote("");
    setResting(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const todayWorkouts = workouts.filter((w) => w.date === todayKey());
  const todayVolume = todayWorkouts.reduce((a, w) => a + volume(w), 0);
  const todaySets = todayWorkouts.reduce((a, w) => a + w.sets.length, 0);

  // group drafts by exercise for the summary chip
  const moveChips = useMemo(() => {
    const counts = new Map<string, number>();
    drafts.forEach((d) => counts.set(d.exercise, (counts.get(d.exercise) ?? 0) + 1));
    return [...counts.entries()];
  }, [drafts]);

  return (
    <div>
      <h1>Today ⚡</h1>
      <p className="sub">
        {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      </p>

      <div className="stat-row">
        <div className="stat"><b>{todayWorkouts.length}</b><span>workouts</span></div>
        <div className="stat"><b>{todaySets}</b><span>sets</span></div>
        <div className="stat"><b>{todayVolume.toLocaleString()}</b><span>lbs moved</span></div>
      </div>

      {resting !== null && (
        <div className="card mt12">
          <div className="rest-label">Rest</div>
          <div className="rest-timer">
            {Math.floor(resting / 60)}:{String(resting % 60).padStart(2, "0")}
          </div>
          <button className="btn btn-full" onClick={() => setResting(null)}>Skip rest →</button>
        </div>
      )}

      <h2>Quick moves</h2>
      <div className="qrow">
        {MOVES.map((m) => (
          <button className="qmove" key={m.name} onClick={() => addMove(m.name)}>
            <span className="qm-em">{m.emoji}</span>
            <b>{m.name}</b>
            <span>{m.weight != null ? `${m.weight} lb` : "bodyweight"}</span>
          </button>
        ))}
      </div>

      {drafts.length > 0 && (
        <>
          <h2>This session</h2>
          {drafts.map((d, i) => {
            const pr = prFor(workouts, d.exercise);
            const last = lastSet(workouts, d.exercise);
            const isPR = d.weightLb != null && pr != null && d.weightLb > pr;
            const listId = `ex-${d.key}`;
            return (
              <div className="card" key={d.key}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="idx">{i + 1}</span>
                  {isPR && <span className="pr-badge">PR!</span>}
                  <button className="del" style={{ marginLeft: "auto", width: 34, height: 34, borderRadius: 12, border: "1px solid var(--line)", background: "transparent", color: "var(--text2)" }} onClick={() => setDrafts((x) => x.filter((y) => y.key !== d.key))}>
                    ✕
                  </button>
                </div>
                <input
                  className="input mt8"
                  list={listId}
                  value={d.exercise}
                  onChange={(e) => patchDraft(d.key, { exercise: e.target.value })}
                  placeholder="Exercise"
                />
                <datalist id={listId}>
                  {exerciseNames.map((n) => <option key={n} value={n} />)}
                </datalist>
                <div className="row mt8">
                  <div className="grow">
                    <label className="hint">REPS</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={d.reps}
                      onChange={(e) => patchDraft(d.key, { reps: parseInt(e.target.value, 10) || 0 })}
                    />
                  </div>
                  <div className="grow">
                    <label className="hint">LB</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={d.weightLb ?? ""}
                      onChange={(e) => patchDraft(d.key, { weightLb: e.target.value === "" ? null : parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
                {last && (
                  <p className="hint" style={{ margin: "8px 0 0" }}>
                    Last time: <b>{last.reps} reps{last.weightLb != null ? ` @ ${last.weightLb} lb` : ""}</b>
                  </p>
                )}
              </div>
            );
          })}

          <div className="chips mt8">
            {moveChips.map(([n, c]) => (
              <span className="chip on" key={n}>{n} ×{c}</span>
            ))}
          </div>

          <div className="card mt12">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Workout name (optional)" />
            <input className="input mt8" value={note} onChange={(e) => setNote(e.target.value)} placeholder="How did it feel? (optional)" />
          </div>
        </>
      )}

      {drafts.length === 0 && (
        <div className="empty">
          Tap a move above to start — every set auto-logs, times your rest, and flags PRs. 🪑🫡
        </div>
      )}

      <div className="chips mt12">
        <button className="chip" onClick={addBlank}>+ Custom set</button>
      </div>

      <button className="btn btn-primary btn-full mt12" onClick={saveWorkout} disabled={!drafts.length}>
        {saved ? "✓ Logged!" : `Finish workout${drafts.length ? ` (${drafts.length} set${drafts.length > 1 ? "s" : ""})` : ""}`}
      </button>

      {todayWorkouts.length > 0 && (
        <>
          <h2>Already today</h2>
          {todayWorkouts.map((w) => (
            <div className="card" key={w.id}>
              <b>{w.name}</b>
              <span className="hint" style={{ marginLeft: 8 }}>
                {w.sets.length} sets · {volume(w).toLocaleString()} lbs
              </span>
              <p className="hint" style={{ margin: "6px 0 0" }}>
                {[...new Set(w.sets.map((s) => s.exercise))].join(" · ")}
              </p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
