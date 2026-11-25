# Q86 — Page photo : écran (T-31c)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Adresse** : `/p/{id}` (03-architecture, Q70), sans le slug du titre de 07-design (`/p/{id}-{slug}`) ; un slug
    pourra s'ajouter plus tard avec une redirection.
  - **Contenu** : fil d'Ariane (accueil, version, titre), l'image (cadre de la couleur de sa qualité), le badge de
    qualité, le panneau façon objet (titre, « {qualité} capture · {version} », zone et heure en jeu, réglages,
    personnage, dimensions et format, légende, date de publication et téléchargements à partir de 10), la
    description, l'auteur (avatar et lien vers son profil) et les tags (texte : pas encore de page par tag).
  - **Absents tant que leur tâche n'est pas faite** : like (T-40), téléchargement HD et la ligne « Use: … wallpaper »
    (T-34), partage (T-42), commentaires (T-41), précédent / suivant et « More from » (T-31b), plein écran, collection,
    signalement et « Follow » (sans tâche au MVP ou v1.x) ; pas de compteur de vues (aucune donnée).
  - **Badge (US-71.2)** : « Rare · 15+ likes · 35 likes to Epic » au survol, au focus clavier et au toucher (bouton) ;
    la feuille du bas au toucher (US-67.3) vient avec T-31b, qui cite cette story.
  - **Robots (US-25.1)** : titre « {titre} — {version} » ; description = description, sinon légende, sinon une phrase
    « {titre}, a {version} screenshot captured by {author} » ; `og:type` article ; `ImageObject` avec `contentUrl`
    (1200 px), `thumbnailUrl` (`og.jpg`), auteur et son profil, date, licence = `/terms`. Les URL absolues prennent
    l'origine de la requête (le domaine de la preview sur une preview).
  - **Texte alternatif (US-75.3)** : celui de l'auteur, sinon « {titre} — {zone}, captured by {auteur} » (sans zone :
    « {titre}, captured by {auteur} ») ; les tuiles de la grille, qui n'ont pas le texte de l'auteur, gardent la
    seconde forme.
  - **Grille** : toute la tuile mène à la page photo (lien de la taille de la capture).
