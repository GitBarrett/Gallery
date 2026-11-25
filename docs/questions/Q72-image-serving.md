# Q72 — Service des images (T-25a)

- **Statut** : Tranché — Adrien, 25/11/2026 (options appliquées retenues)
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Refus** : toute largeur hors `400/800/1200/2400/og.jpg`, capture inconnue, non publiée sans droit ou variante
    absente → 404 sans corps, `Cache-Control: no-store` (pas le format d'erreur de l'API, réservé à `/api`).
  - **Aperçu privé** (`?preview=1`) : l'auteur, même suspendu, et les modérateurs ou admins **après le TOTP** ; un
    modérateur avant le TOTP → 404. `failed` suit la règle des autres statuts (sans variante : 404).
    `?preview=1` sur une capture publiée sert l'image publique.
  - **Capture masquée** : ses variantes sont lues dans `trash/` pour l'aperçu. `removeImages` (variantes vers
    `trash/` + purge des 5 adresses) est livré ici et sera appelé par le masquage et la suppression (T-58, US-12.2) ;
    la purge ne fait rien sans `CF_API_TOKEN_PURGE` et `CF_ZONE_ID` (previews sur workers.dev, sans cache).
  - **Capture refusée** (T-24) : ses variantes sont supprimées, pas mises dans `trash/` ; l'original y est.
  - **Session** : lue seulement avec `?preview=1` ; une image publique ne touche jamais la table `sessions`.
  - **Pas de** gestion des requêtes conditionnelles (`ETag`) ni partielles (`Range`), ni de règle anti-hotlinking
    (coût borné par le cache, 08 § 2).
