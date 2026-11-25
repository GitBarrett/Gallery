# Q65 — Catalogue : versions du jeu et tags (T-20a)

- **Statut** : Tranché — Adrien, 25/11/2026 (options appliquées retenues)
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - Versions au lancement (migration 0009), dans cet ordre : `wow-forever` « WoW Forever », `retail` « Retail », `classic-era` « Classic Era », `classic-progression` « Classic progression », `other` « Other » / « Autre ». Seul « Other » est traduit en français ; les slugs servent aux URL `/v/{slug}`.
  - `GET /api/game-versions` ne renvoie que les versions non archivées (l'admin les listera toutes en T-53a).
  - Caractères d'un tag : lettres, chiffres, espaces et tirets simples, après normalisation (minuscules, accents retirés, « œ » → « oe », « æ » → « ae », espaces fusionnés) ; un autre caractère (`#`, `'`…) refuse le tag.
  - Suggestions : tags commençant par la saisie normalisée, ordre alphabétique, 10 au plus, dès le premier caractère ; pas de tri par popularité (aucun compteur d'usage dans `tags`).
  - Les tags sont créés librement à la publication (T-21) ; T-20a ne fait que les lire.
