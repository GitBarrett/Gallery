# Q88 — Navigation entre captures : écran (T-31d)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Boutons** : deux boutons ronds au pied de l'image (maquette Photo), des liens vers les pages voisines (sans
    script, lisibles par les robots) ; un bouton absent au bout de la version. Le bouton « Full screen » de la
    maquette n'est pas repris (aucune tâche ne cite le plein écran ni le pinch-zoom).
  - **Swipe (US-67.2)** : au doigt seulement, sur l'image ; au moins 50 px et un geste plus horizontal que vertical
    (sinon c'est le défilement de la page) ; vers la gauche = suivante, vers la droite = précédente ; pas d'animation
    de glissement (changement de page direct).
  - **Clavier** : flèche gauche = précédente, droite = suivante, sauf pendant une saisie ou avec une touche de
    modification.
  - **Bloc « More from »** : un titre par section (« More from {auteur} », « Similar captures », « More from {zone} »,
    « Latest in {version} »), des miniatures carrées 2 × 2 au cadre de la couleur de leur qualité, liens vers leur
    page ; aucun bloc s'il n'y a rien.
  - **Feuille du bas au toucher (US-67.3)** : un toucher (pointeur grossier) sur le badge de qualité ouvre une
    feuille du bas avec le niveau, son seuil et les likes manquants ; souris et clavier gardent l'infobulle. Le
    panneau façon objet est déjà affiché en entier à côté de l'image (aucune infobulle à ouvrir).
  - **Correction** : la recherche des voisines (T-31b) lit désormais la position de la capture dans la table (un
    `published_at` à la microseconde la rendait sa propre voisine).
