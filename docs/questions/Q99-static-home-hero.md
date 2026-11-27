# Q99 — Hero de la home fixe

- **Statut** : Validée — Adrien, 27/11/2026 (« La hero ne doit pas être dynamique »)
- **Décision** : le hero de la home est une capture fixe d'Ash Barrett (forêt de nuit), servie depuis
  `public/hero/` en WebP 1280 et 2560 px, au lieu de la capture choisie par l'admin ou de la dernière capture publique
  assez sombre (Q89, 07 § Hero). Crédit fixe : « Background: a screenshot by Ash Barrett », sans lien.
- **Code** : le hero dynamique de `HomeHero.vue` est gardé en commentaire ; `GET /api/home` continue de renvoyer
  `hero`, que l'écran ignore. Le choix par l'admin (T-53b) réactivera le hero dynamique, ou retirera ce code.
- **Écart aux specs** : US-24.1 et 07 § Hero décrivent une capture de la communauté ; à mettre à jour si la décision
  devient définitive.
