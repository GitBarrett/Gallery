# Q83 — Grille de la galerie : écran (T-30b)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Découpage** : T-30b devient la grille (bandeau, versions, grille, défilement infini, 404, état vide) ; les
    filtres et l'infobulle de qualité passent dans T-30c.
  - **« Explore »** (en-tête et barre d'onglets) : ouvre la PLP de la première version du catalogue (WoW Forever),
    tant qu'aucune page propre n'existe ; il menait jusqu'ici à une 404.
  - **Bandeau** : fil d'Ariane, nom de la version et liens vers les autres versions (non archivées). Les compteurs
    « 12,480 captures · 1,906 photographers » et la phrase d'accroche de la maquette sont absents (aucune donnée ni
    texte par version) ; les « Popular tags » aussi (aucune popularité de tag au MVP).
  - **Tuile** : l'image à son propre ratio, le badge de qualité dans le coin, puis sous l'image le titre (couleur
    de sa qualité), « zone · auteur » (nom de la zone dans la langue du site) et les likes à partir de 10 ; en
    dessous, « New » (07 § Aucun bloc vide). Pas de lien vers la page photo tant qu'elle n'existe pas (T-31a).
  - **Défilement infini** : la page suivante se charge 600 px avant la fin de la grille ; le bouton « Load more
    captures » reste affiché (clavier, navigateurs sans `IntersectionObserver`) ; après la dernière page,
    « You've seen everything ».
  - **État vide** : titre « Be the first to capture {version} », une phrase et le bouton « Upload a capture ».
  - **SEO** : titre « {version} captures » et description ; canonique et `hreflang` avec T-35.
