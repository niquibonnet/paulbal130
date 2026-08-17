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
  const AKEY = "sacoches-activity";
  const channel = "BroadcastChannel" in window ? new BroadcastChannel("sacoches") : null;
  let listeners = [];
  let actListeners = [];

  const load = (key = KEY) => {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
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
    const acts = load(AKEY).sort((a, b) => b.at - a.at);
    actListeners.forEach((cb) => cb(acts));
  };
  const logActivity = (entry) => {
    const acts = load(AKEY);
    acts.push({ id: "act-" + Math.random().toString(36).slice(2), at: Date.now(), ...entry });
    localStorage.setItem(AKEY, JSON.stringify(acts));
  };
  channel?.addEventListener("message", emit);

  return {
    mode: "local",
    subscribe(cb) {
      listeners.push(cb);
      emit();
      return () => (listeners = listeners.filter((l) => l !== cb));
    },
    subscribeActivity(cb) {
      actListeners.push(cb);
      emit();
      return () => (actListeners = actListeners.filter((l) => l !== cb));
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
      logActivity({ type: "ajout", player, pts, note });
      save(points);
    },
    async deletePoint(point) {
      logActivity({ type: "suppression", player: point.player, pts: point.pts, note: point.note });
      save(load().filter((p) => p.id !== point.id));
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
  const actCol = fs.collection(db, "activity");

  // Le journal ne doit jamais bloquer l'action principale : erreurs avalées.
  const logActivity = (entry) => {
    fs.addDoc(actCol, {
      ...entry,
      createdAt: fs.serverTimestamp(),
      clientAt: Date.now(),
      dev: DEVICE_ID,
    }).catch((err) => console.warn("Journal non enregistré :", err));
  };

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
    subscribeActivity(cb) {
      return fs.onSnapshot(
        actCol,
        (snap) => {
          const entries = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              type: data.type,
              player: data.player,
              pts: data.pts,
              note: data.note,
              at: data.createdAt?.toMillis?.() ?? data.clientAt ?? Date.now(),
            };
          });
          entries.sort((a, b) => b.at - a.at);
          cb(entries);
        },
        // Tant que les règles Firestore n'autorisent pas /activity,
        // le journal reste vide sans casser le reste de l'app.
        (err) => {
          console.warn("Journal indisponible :", err);
          cb([]);
        }
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
      logActivity({ type: "ajout", player, pts, note });
    },
    async deletePoint(point) {
      await fs.deleteDoc(fs.doc(db, "points", point.id));
      logActivity({ type: "suppression", player: point.player, pts: point.pts, note: point.note });
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
