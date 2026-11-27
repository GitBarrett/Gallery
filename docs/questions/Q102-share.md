# Q102 — Partage (T-42)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Feuille native** dès que le navigateur a `navigator.share` (mobiles, certains navigateurs de bureau), sinon le
    menu : « Copy link », X, Facebook, Reddit, « Discord (copy the link) » (Discord n'a pas d'URL de partage).
  - **Lien partagé** : l'URL canonique de la page photo, dans la langue de la page.
  - **Événement `photo_shared`** : propriété `method` (`native`, `copy`, `x`, `facebook`, `reddit`, `discord`), après
    consentement seulement ; un partage natif annulé n'envoie rien.
  - **Correction des Q94, Q98 et Q100** : `useAnalytics` existait déjà (consentement, PostHog EU sans SDK) ;
    `photo_downloaded`, `photo_liked` et `comment_posted` peuvent donc être émis. À brancher dans une petite PR à part
    (proposée), plutôt que dans celle-ci.
