# Q79 — Modifier et supprimer une capture : écran (T-27b)

- **Statut** : Tranché — Adrien, 25/11/2026 (options appliquées retenues)
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Accès** : boutons « Edit » et « Delete » sur chaque carte de « My captures », sauf pendant le traitement.
    Pas de maquette : design system seul.
  - **Modification** : page `/my-captures/{id}` (privée, jamais en cache) avec les champs de l'upload remplis
    (titre, zone, heure, réglages, personnage, légende, description, texte alternatif, tags) et le point focal sur
    l'image quand elle a des variantes ; « Save the changes » envoie tous les champs (un champ vidé est effacé), puis
    « Changes saved. ». La version du jeu et l'image ne se modifient pas.
  - **Lecture des détails** : `GET /api/me/photos/{id}`, réservé à l'auteur (404 sinon), zone et tags nommés par le
    catalogue.
  - **Suppression** : confirmation dans une boîte de dialogue (« … will disappear everywhere on the site. This
    cannot be undone. »), puis la carte quitte la liste et « The capture was deleted. » s'affiche.
  - **À vérifier (cache)** : sur la preview, `/img/{id}/800` d'une capture supprimée répondait encore 200, même
    avec un paramètre ajouté à l'URL, alors que la capture n'existe plus en base (le serveur répond 404 pour une
    capture inconnue : tests unitaire et d'intégration). Une couche de cache de Cloudflare en amont du Worker est
    probable ; à vérifier avec le domaine définitif et la purge (`CF_API_TOKEN_PURGE`, `CF_ZONE_ID`). L'E2E ne
    vérifie plus l'image après la suppression.
