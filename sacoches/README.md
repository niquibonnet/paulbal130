# 👜 Les Points Sacoches

Compteur de points sacoches collaboratif des 9 copains :
Côme, Paul, Gaspard, Erwann, Timothée, Ihsane, Jacques, Nico et Vianney.

Accessible sur **https://paulbal130.fr/sacoches/** — site statique, aucun
compte requis, tout le monde avec le lien peut ajouter des points.

## Fonctionnalités

- 🏆 Classement du plus sacoche au moins sacoche, podium + couronne pour le champion
- ➕ Ajout de point ouvert à tous : gravité 1 / 2 / 3, ou **SUPER SACOCHE +5** 🔥👜
- 📝 Motif obligatoire, date automatique
- 👤 Historique complet par copain (clic sur un prénom)
- 😂👍👎👜 Réactions emoji avec compteur sur chaque point
- ⚖️ Tribunal populaire : 5 👎 sur un point → son auteur (« qui balance ») prend automatiquement 1 point sacoche
- 📊 Statistiques : évolution par copain, total du groupe, moyenne, record du mois, Super Sacoches
- 🕰️ Journal : trace de chaque ajout et de chaque suppression (infalsifiable, même après suppression du point)
- 🔔 Notifications (nom + motif) activables par chacun
- 🗑️ Suppression d'un point en cas d'erreur, avec confirmation
- ⚡ Interface mobile-first, mises à jour optimistes, synchro temps réel

## ⚠️ Activer la synchro temps réel (à faire une fois, ~5 min, gratuit)

Par défaut l'app tourne en **mode local** (les points restent sur l'appareil).
Pour que les points soient **partagés en temps réel entre tous les copains**,
il faut créer un projet Firebase (gratuit, plan Spark) :

1. Aller sur https://console.firebase.google.com et créer un projet
   (ex. `points-sacoches`). Google Analytics : inutile, décocher.
2. Dans le projet : **Build → Firestore Database → Créer une base de données**,
   mode *production*, région `europe-west1` (ou proche).
3. Onglet **Règles** de Firestore : coller les règles ci-dessous puis **Publier**.
4. Paramètres du projet (roue dentée) → **Vos applications → Web (`</>`)** →
   enregistrer une app (pas besoin de Hosting). Firebase affiche un objet
   `firebaseConfig`.
5. Copier ces valeurs dans `sacoches/firebase-config.js`, et passer
   `FIREBASE_ENABLED` à `true`.
6. Commit + push : c'est en ligne, tous les appareils sont synchronisés.

### Règles Firestore à coller

Elles laissent l'accès ouvert (pas de comptes) mais n'acceptent que des
données valides — joueurs connus, points 1/2/3/5, motif obligatoire,
seules les réactions sont modifiables, et le journal est inaltérable.
Le bloc à copier est dans **`REGLES-FIRESTORE.md`** (source unique, à
recoller dans la console à chaque évolution des règles).

## Notes techniques

- Aucun build : HTML/CSS/JS vanilla, SDK Firebase chargé depuis le CDN Google.
- Mises à jour optimistes : Firestore applique les écritures localement avant
  confirmation serveur, l'interface réagit donc instantanément ; cache
  persistant activé (l'app s'ouvre même hors ligne avec les dernières données).
- Notifications : affichées via l'API Notifications + service worker quand un
  nouveau point arrive **tant qu'un onglet de l'app est ouvert** (même en
  arrière-plan). Un vrai push serveur (app fermée) demanderait Firebase Cloud
  Messaging + une fonction serveur, non inclus ici.
- Les réactions "déjà votées" et la préférence de notification sont mémorisées
  par appareil (localStorage).
