"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  equipmentStore,
  workoutStore,
  seedIfEmpty,
  prFor,
  lastSet,
  volume,
  todayKey,
  uid,
  type Equipment,
  type SetEntry,
  type Workout,
} from "@/lib/db";

// Suggested exercises per equipment category.
const SUGGESTIONS: Record<string, string[]> = {
  weights: ["DB Bench Press", "DB Row", "DB Shoulder Press", "DB Curl", "Lateral Raise", "DB Squat", "DB Skullcrusher"],
  bodyweight: ["Pull-ups", "Push-ups", "Dips", "Plank", "Hanging Leg Raise"],
  cardio: ["Jump Rope", "Burpees", "Mountain Climbers"],
  misc: ["Band Pull-apart", "Band Curl", "Face Pull"],
};

type Draft = SetEntry & { key: string };

export default function TodayPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [resting, setResting] = useState<number | null>(null);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      await seedIfEmpty();
      setEquipment(await equipmentStore.all());
      setWorkouts(await workoutStore.all());
    })();
  }, []);

  // Rest timer
  useEffect(() => {
    if (resting === null) return;
    restRef.current = setInterval(() => {
      setResting((r) => {
        if (r === null) return null;
        if (r <= 1) {
          if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(200);
          return null;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (restRef.current) clearInterval(restRef.current);
    };
  }, [resting]);

  const exerciseNames = useMemo(() => {
    const fromHistory = new Set<string>();
    workouts.forEach((w) => w.sets.forEach((s) => fromHistory.add(s.exercise)));
    return [...fromHistory];
  }, [workouts]);

  function addSet(equipmentId: string | null = null) {
    const eq = equipment.find((e) => e.id === equipmentId);
    const cat = eq?.category ?? "weights";
    const suggested = SUGGESTIONS[cat]?.[0] ?? "Exercise";
    setDrafts((d) => [
      ...d,
      { key: uid(), exercise: suggested, equipmentId, reps: 10, weightLb: eq?.weightLb ?? null },
    ]);
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
      name: name.trim() || defaultName(),
      durationMin: duration ? parseInt(duration, 10) : null,
      sets: sets.map(({ key, ...s }) => s as SetEntry),
      note: note.trim(),
      createdAt: Date.now(),
    };
    await workoutStore.put(w);
    setWorkouts(await workoutStore.all());
    setDrafts([]);
    setName("");
    setDuration("");
    setNote("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function defaultName(): string {
    const count = workouts.filter((w) => w.date === todayKey()).length;
    return count ? `Workout #${count + 1}` : "Today's workout";
  }

  const todayWorkouts = workouts.filter((w) => w.date === todayKey());
  const todayVolume = todayWorkouts.reduce((a, w) => a + volume(w), 0);
  const todaySets = todayWorkouts.reduce((a, w) => a + w.sets.length, 0);

  return (
    <div>
      <h1>Today ⚡</h1>
      <p className="sub">
        {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
      </p>

      <div className="stat-row">
        <div className="stat"><b>{todayWorkouts.length}</b><span>workouts</span></div>
        <div className="stat"><b>{todaySets}</b><span>sets</span></div>
        <div className="stat"><b>{todayVolume.toLocaleString()}</b><span>lbs moved</span></div>
      </div>

      {resting !== null && (
        <div className="card mt12">
          <div className="rest-timer">{Math.floor(resting / 60)}:{String(resting % 60).padStart(2, "0")}</div>
          <button className="btn btn-full" onClick={() => setResting(null)}>Stop rest</button>
        </div>
      )}

      <h2>Log a workout</h2>

      {drafts.map((d, i) => {
        const pr = prFor(workouts, d.exercise);
        const last = lastSet(workouts, d.exercise);
        const isPR = d.weightLb != null && pr != null && d.weightLb > pr;
        const listId = `ex-list-${d.key}`;
        return (
          <div className="card" key={d.key}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <b style={{ fontSize: 12, color: "var(--text2)" }}>SET {i + 1}</b>
              {isPR && <span className="pr-badge">PR!</span>}
              <button
                className="btn"
                style={{ marginLeft: "auto", padding: "6px 10px", fontSize: 13 }}
                onClick={() => setDrafts((x) => x.filter((y) => y.key !== d.key))}
              >
                ✕
              </button>
            </div>
            <input
              className="input"
              list={listId}
              value={d.exercise}
              onChange={(e) => patchDraft(d.key, { exercise: e.target.value })}
              placeholder="Exercise"
              style={{ marginTop: 8 }}
            />
            <datalist id={listId}>
              {[...new Set([...exerciseNames, ...Object.values(SUGGESTIONS).flat()])].map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <div className="row mt8">
              <select
                className="input"
                value={d.equipmentId ?? ""}
                onChange={(e) => patchDraft(d.key, { equipmentId: e.target.value || null })}
              >
                <option value="">No equipment</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>{eq.emoji} {eq.name}</option>
                ))}
              </select>
            </div>
            <div className="row mt8">
              <div className="grow">
                <label className="hint">REPS</label>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  value={d.reps}
                  onChange={(e) => patchDraft(d.key, { reps: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
              <div className="grow">
                <label className="hint">WEIGHT (LB)</label>
                <input
                  className="input"
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

      {drafts.length === 0 && (
        <div className="empty">
          No sets yet. Tap below to start logging — you'll see last time's numbers and live PR alerts.
        </div>
      )}

      <div className="chips mt12">
        <button className="chip" onClick={() => addSet(null)}>+ Set</button>
        {equipment.slice(0, 6).map((eq) => (
          <button className="chip" key={eq.id} onClick={() => addSet(eq.id)}>
            {eq.emoji} {eq.name.split(" ")[0]}
          </button>
        ))}
      </div>

      {drafts.length > 0 && (
        <div className="card mt12">
          <div className="row">
            <div className="grow">
              <label className="hint">WORKOUT NAME</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={defaultName()} />
            </div>
            <div style={{ width: 90 }}>
              <label className="hint">MINS</label>
              <input className="input" type="number" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
          </div>
          <input className="input mt8" value={note} onChange={(e) => setNote(e.target.value)} placeholder="How did it feel?" />
        </div>
      )}

      <button className="btn btn-primary btn-full mt12" onClick={saveWorkout} disabled={!drafts.length}>
        {saved ? "✓ Saved!" : "Finish workout"}
      </button>

      {todayWorkouts.length > 0 && (
        <>
          <h2>Already today</h2>
          {todayWorkouts.map((w) => (
            <div className="card" key={w.id}>
              <b>{w.name}</b>
              <span className="hint" style={{ marginLeft: 8 }}>
                {w.sets.length} sets · {volume(w).toLocaleString()} lbs{w.durationMin ? ` · ${w.durationMin} min` : ""}
              </span>
              <p className="hint" style={{ margin: "6px 0 0" }}>
                {w.sets.map((s) => s.exercise).filter((v, i, a) => a.indexOf(v) === i).join(" · ")}
              </p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
