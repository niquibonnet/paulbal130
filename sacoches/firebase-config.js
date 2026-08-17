// ============================================================
//  CONFIGURATION FIREBASE — Les Points Sacoches
// ============================================================
//  Tant que ce fichier n'est pas rempli, l'app tourne en
//  "mode local" : les points ne sont enregistrés que sur
//  l'appareil (pratique pour tester, mais pas partagé).
//
//  Pour activer la synchro temps réel entre tous les copains
//  (5 minutes, gratuit) : suivre sacoches/README.md, puis
//  coller ici la config donnée par Firebase.
// ============================================================

export const firebaseConfig = {
  apiKey: "REMPLACE_MOI",
  authDomain: "REMPLACE_MOI.firebaseapp.com",
  projectId: "REMPLACE_MOI",
  storageBucket: "REMPLACE_MOI.appspot.com",
  messagingSenderId: "REMPLACE_MOI",
  appId: "REMPLACE_MOI",
};

// Passe à true une fois la config remplie.
export const FIREBASE_ENABLED = false;
