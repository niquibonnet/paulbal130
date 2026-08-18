# 📱 Publier « Les Points Sacoches » sur les stores

L'app est une PWA (manifeste + service worker + icônes : déjà en place).
C'est la base des deux chemins ci-dessous. Aucune réécriture : les stores
distribuent une coquille qui affiche l'app du site — chaque `git push`
met donc à jour l'app de tout le monde, sans repasser par les stores.

## Android (Google Play) — le plus simple : TWA via Bubblewrap

Une « Trusted Web Activity » emballe la PWA telle quelle. Sur votre machine
(Node 18+ et un JDK ; Bubblewrap sait installer le SDK Android tout seul) :

```bash
npm i -g @bubblewrap/cli
mkdir sacoches-android && cd sacoches-android
bubblewrap init --manifest https://paulbal130.fr/sacoches/manifest.webmanifest
# répondre aux questions (nom, package ex. fr.paulbal130.sacoches, créer une clé de signature)
bubblewrap build
```

Ça produit un `app-release-bundle.aab` à téléverser dans la Play Console
(app → Production ou Test fermé → nouvelle version).

**Étape indispensable — assetlinks** : pour que l'app s'ouvre plein écran
(sans barre d'adresse), Google vérifie que vous possédez le domaine.
`bubblewrap fingerprint` (ou la Play Console → Signature de l'app) donne
une empreinte SHA-256 ; il faut alors publier sur le site un fichier
`/.well-known/assetlinks.json` **à la racine du domaine** :

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "fr.paulbal130.sacoches",
    "sha256_cert_fingerprints": ["EMPREINTE_SHA256_ICI"]
  }
}]
```

→ Envoyez-moi l'empreinte et le nom de package : j'ajoute le fichier au
dépôt (avec le `.nojekyll` nécessaire pour que GitHub Pages serve le
dossier `.well-known`).

À prévoir côté Play Console : fiche du store (captures, description),
questionnaire « classification du contenu », et pour un compte personnel
récent une phase de test fermé (~12 testeurs pendant 14 jours) avant la
production. Les 9 copains suffisent presque — ajoutez quelques comptes.

## iOS (App Store) — via Capacitor, sur un Mac

Apple n'a pas d'équivalent TWA : il faut une coquille Capacitor et Xcode.

```bash
mkdir sacoches-ios && cd sacoches-ios && npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "Les Points Sacoches" fr.paulbal130.sacoches
```

Dans `capacitor.config.ts`, pointez la coquille vers le site (mode "remote") :

```ts
const config = {
  appId: "fr.paulbal130.sacoches",
  appName: "Les Points Sacoches",
  webDir: "www",            // dossier factice avec un index.html vide
  server: { url: "https://paulbal130.fr/sacoches/", allowNavigation: ["paulbal130.fr"] },
};
```

Puis `npx cap add ios`, `npx cap open xcode`, signer avec votre équipe,
et archiver → App Store Connect.

**Avertissement honnête** : la revue Apple refuse souvent les apps
« coquille de site web » (guideline 4.2 — minimum de fonctionnalités) et
les apps à audience très restreinte. Deux parades : distribuer via
**TestFlight** seulement (aucune revue stricte, 100 testeurs, largement
assez pour 9 copains — recommandé), ou étoffer la coquille (notifications
push natives, écran hors-ligne) avant de tenter le store public.

## Récap effort

| Chemin | Difficulté | Délai réaliste |
|---|---|---|
| PWA (déjà fait) | — | ✅ en ligne |
| Android TWA → Play | facile | 1-2 h de manip + attentes Play |
| iOS TestFlight | moyen (Mac requis) | une demi-journée |
| iOS App Store public | risque de rejet | variable |
