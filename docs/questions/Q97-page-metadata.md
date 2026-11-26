# Q97 — Métadonnées des pages (T-35b)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Pages publiques** (accueil, galeries `/v/{version}`, profils, recherche, pages légales) : titre, description,
    `og:title`, `og:description`, `og:url`, URL canonique et `hreflang` en / fr / x-default, comme la page photo.
  - **Canonique** : sans les filtres ni le tri sur une galerie (une page par version) ; la recherche garde son texte
    (`/search?q=…`), sans filtres ni tri. L'origine est celle de la requête, comme pour la page photo.
  - **Descriptions** : galerie et recherche reprennent les textes existants ; profil « World of Warcraft screenshots
    captured by {username} on Legendary Shots. » (pas la bio) ; pages légales « {titre} of Legendary Shots… ».
  - **Pas d'image Open Graph** hors page photo (aucune image par défaut n'existe encore).
  - **Pages privées non indexées** (`X-Robots-Tag: noindex`, en / fr) : réglages, upload, « My captures »,
    notifications, connexion, inscription, mot de passe oublié, vérification et confirmation d'email, fin d'OAuth,
    hors ligne. La recherche reste indexable (Q93).
