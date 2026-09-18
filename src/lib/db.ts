// ── FITMAX on-device database ────────────────────────────────────────────────
// Everything lives in the browser's IndexedDB. No server, no accounts, no
// wipes. Export JSON from Settings to move data between devices.

export type Equipment = {
  id: string;
  name: string;
  emoji: string;
  category: string; // weights | cardio | bodyweight | misc
  weightLb: number | null; // for weighted items (dumbbell max, kettlebell, etc.)
  note: string;
  createdAt: number;
};

export type SetEntry = {
  exercise: string;
  equipmentId: string | null;
  reps: number;
  weightLb: number | null;
};

export type Workout = {
  id: string;
  date: string; // YYYY-MM-DD (local)
  name: string;
  durationMin: number | null;
  sets: SetEntry[];
  note: string;
  createdAt: number;
};

const DB_NAME = "fitmax";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("equipment")) {
          db.createObjectStore("equipment", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("workouts")) {
          db.createObjectStore("workouts", { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Equipment ────────────────────────────────────────────────────────────────
export const equipmentStore = {
  all: () => tx<Equipment[]>("equipment", "readonly", (s) => s.getAll() as IDBRequest<Equipment[]>),
  put: (e: Equipment) => tx("equipment", "readwrite", (s) => s.put(e)),
  del: (id: string) => tx("equipment", "readwrite", (s) => s.delete(id)),
};

// ── Workouts ─────────────────────────────────────────────────────────────────
export const workoutStore = {
  all: () => tx<Workout[]>("workouts", "readonly", (s) => s.getAll() as IDBRequest<Workout[]>),
  put: (w: Workout) => tx("workouts", "readwrite", (s) => s.put(w)),
  del: (id: string) => tx("workouts", "readwrite", (s) => s.delete(id)),
};

/** Best (heaviest) weight ever lifted for an exercise. */
export function prFor(workouts: Workout[], exercise: string): number | null {
  let best: number | null = null;
  for (const w of workouts) {
    for (const s of w.sets) {
      if (s.exercise === exercise && s.weightLb != null && (best === null || s.weightLb > best)) best = s.weightLb;
    }
  }
  return best;
}

/** Last time this exercise was done — for "last time" hints while logging. */
export function lastSet(workouts: Workout[], exercise: string): SetEntry | null {
  const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date));
  for (const w of sorted) {
    const s = w.sets.find((x) => x.exercise === exercise);
    if (s) return s;
  }
  return null;
}

/** Total volume (lbs moved) for a workout. */
export function volume(w: Workout): number {
  return w.sets.reduce((a, s) => a + s.reps * (s.weightLb ?? 0), 0);
}

// ── Seed data (first launch) ─────────────────────────────────────────────────
const SEED_EQUIPMENT: Omit<Equipment, "id" | "createdAt">[] = [
  { name: "Dumbbells (pair)", emoji: "🏋️", category: "weights", weightLb: 50, note: "Adjustable? note the max here" },
  { name: "Kettlebell", emoji: "🔔", category: "weights", weightLb: 35, note: "" },
  { name: "Pull-up bar", emoji: "🧗", category: "bodyweight", weightLb: null, note: "" },
  { name: "Bench", emoji: "🛏️", category: "weights", weightLb: null, note: "" },
  { name: "Resistance bands", emoji: "🎗️", category: "misc", weightLb: null, note: "" },
  { name: "Yoga mat", emoji: "🧘", category: "misc", weightLb: null, note: "" },
  { name: "Jump rope", emoji: "🪢", category: "cardio", weightLb: null, note: "" },
];

export async function seedIfEmpty(): Promise<void> {
  const eq = await equipmentStore.all();
  if (eq.length > 0) return;
  for (const e of SEED_EQUIPMENT) {
    await equipmentStore.put({ ...e, id: uid(), createdAt: Date.now() });
  }
}

// ── Export / import ──────────────────────────────────────────────────────────
export async function exportAll(): Promise<string> {
  const [equipment, workouts] = await Promise.all([equipmentStore.all(), workoutStore.all()]);
  return JSON.stringify({ app: "FITMAX", exportedAt: new Date().toISOString(), equipment, workouts }, null, 2);
}

export async function importAll(json: string): Promise<void> {
  const data = JSON.parse(json);
  if (data.app !== "FITMAX") throw new Error("Not a FITMAX export");
  for (const e of data.equipment ?? []) await equipmentStore.put(e);
  for (const w of data.workouts ?? []) await workoutStore.put(w);
}
