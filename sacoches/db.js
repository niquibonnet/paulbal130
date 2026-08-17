// Couche données : même API pour Firebase (partagé, temps réel)
// et pour le mode local (localStorage, mono-appareil).
//
// Un "point" : { id, player, pts (1|2|3|5), note, at (ms),
//               reactions: {laugh, up, skull, bag}, dev (id appareil) }

import { firebaseConfig, FIREBASE_ENABLED } from "./firebase-config.js";

export const DEVICE_ID = (() => {
  let id = localStorage.getItem("sacoches-device");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("sacoches-device", id);
  }
  return id;
})();

export const EMPTY_REACTIONS = { laugh: 0, up: 0, skull: 0, bag: 0 };

// ---------------------------------------------------------------- local

function createLocalBackend() {
  const KEY = "sacoches-points";
  const channel = "BroadcastChannel" in window ? new BroadcastChannel("sacoches") : null;
  let listeners = [];

  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
      return [];
    }
  };
  const save = (points) => {
    localStorage.setItem(KEY, JSON.stringify(points));
    channel?.postMessage("sync");
    emit();
  };
  const emit = () => {
    const points = load().sort((a, b) => b.at - a.at);
    listeners.forEach((cb) => cb(points));
  };
  channel?.addEventListener("message", emit);

  return {
    mode: "local",
    subscribe(cb) {
      listeners.push(cb);
      emit();
      return () => (listeners = listeners.filter((l) => l !== cb));
    },
    async addPoint({ player, pts, note }) {
      const points = load();
      points.push({
        id: "loc-" + Math.random().toString(36).slice(2),
        player,
        pts,
        note,
        at: Date.now(),
        reactions: { ...EMPTY_REACTIONS },
        dev: DEVICE_ID,
      });
      save(points);
    },
    async deletePoint(id) {
      save(load().filter((p) => p.id !== id));
    },
    async react(id, key, delta) {
      const points = load();
      const p = points.find((p) => p.id === id);
      if (!p) return;
      p.reactions = { ...EMPTY_REACTIONS, ...p.reactions };
      p.reactions[key] = Math.max(0, (p.reactions[key] || 0) + delta);
      save(points);
    },
  };
}

// ------------------------------------------------------------- firebase

async function createFirebaseBackend() {
  const { initializeApp } = await import(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
  );
  const fs = await import(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
  );

  const app = initializeApp(firebaseConfig);
  let db;
  try {
    // Cache local persistant : affichage instantané + résilience hors-ligne.
    db = fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({
        tabManager: fs.persistentMultipleTabManager(),
      }),
    });
  } catch {
    db = fs.getFirestore(app);
  }

  const col = fs.collection(db, "points");

  return {
    mode: "firebase",
    subscribe(cb) {
      return fs.onSnapshot(
        col,
        (snap) => {
          const points = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              player: data.player,
              pts: data.pts,
              note: data.note,
              // serverTimestamp est null le temps de l'aller-retour :
              // clientAt permet l'affichage optimiste immédiat.
              at: data.createdAt?.toMillis?.() ?? data.clientAt ?? Date.now(),
              reactions: { ...EMPTY_REACTIONS, ...(data.reactions || {}) },
              dev: data.dev || "",
              pending: d.metadata.hasPendingWrites,
            };
          });
          points.sort((a, b) => b.at - a.at);
          cb(points);
        },
        (err) => console.error("Firestore:", err)
      );
    },
    async addPoint({ player, pts, note }) {
      await fs.addDoc(col, {
        player,
        pts,
        note,
        createdAt: fs.serverTimestamp(),
        clientAt: Date.now(),
        reactions: { ...EMPTY_REACTIONS },
        dev: DEVICE_ID,
      });
    },
    async deletePoint(id) {
      await fs.deleteDoc(fs.doc(db, "points", id));
    },
    async react(id, key, delta) {
      await fs.updateDoc(fs.doc(db, "points", id), {
        ["reactions." + key]: fs.increment(delta),
      });
    },
  };
}

// ---------------------------------------------------------------- init

export async function createBackend() {
  if (FIREBASE_ENABLED && firebaseConfig.projectId !== "REMPLACE_MOI") {
    try {
      return await createFirebaseBackend();
    } catch (err) {
      console.error("Firebase indisponible, repli en mode local :", err);
    }
  }
  return createLocalBackend();
}
