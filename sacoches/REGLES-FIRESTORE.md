# Règles Firestore — Les Points Sacoches 👜

À coller dans la console Firebase :
**Build → Firestore Database → onglet "Règles"**, remplacer tout le contenu
par le bloc ci-dessous, puis cliquer sur **Publier**.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /points/{id} {
      allow read, delete: if true;
      allow create: if
        request.resource.data.player in ['Côme','Paul','Gaspard','Erwan','Timothée','Ihsane','Jacques','Nico','Vianney']
        && request.resource.data.pts in [1, 2, 3, 5]
        && request.resource.data.note is string
        && request.resource.data.note.size() > 0
        && request.resource.data.note.size() <= 300;
      allow update: if
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['reactions']);
    }
  }
}
```

Ce que ces règles garantissent (sans comptes ni identification) :

- **Lecture et suppression ouvertes** à tous ceux qui ont le lien (voulu).
- **Création** acceptée uniquement si le joueur est l'un des 9 copains,
  les points valent 1, 2, 3 ou 5, et le motif est présent (300 caractères max).
- **Modification** limitée aux réactions emoji — impossible de changer
  après coup le joueur, les points ou le motif d'un point existant.
