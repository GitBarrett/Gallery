# Q84 — Filtres de la galerie (T-30c)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **URL** : `?zone={slug}&time={dawn|day|dusk|night}&quality={tier}&sort={popular|downloads}` ; les valeurs par
    défaut (Poor, Most recent) n'y figurent pas ; une valeur inconnue est ignorée. Chaque changement ajoute une
    entrée à l'historique : le retour arrière revient aux filtres précédents. Changer de version repart sans filtre.
  - **Application** : chaque changement s'applique tout de suite (barre dès 768 px ; dans la feuille plein écran
    en dessous, « Show the captures » la referme).
  - **Zone** : un champ avec les suggestions du dictionnaire, comme à l'upload, plutôt que la liste déroulante de la
    maquette (des centaines de zones). Un texte qui n'est pas une zone du dictionnaire ne filtre rien ; une zone de
    l'URL retirée du dictionnaire ne donne aucune capture. Le nom affiché pour une zone de l'URL est lu sur les
    captures qu'elle filtre.
  - **Qualité minimale** : cinq boutons comme sur la maquette ; Poor = toutes les captures.
  - **Aucun résultat** : « No capture matches these filters » et un bouton « Clear the filters » ; un tri seul ne
    compte pas comme un filtre (une version vide garde « Be the first »).
  - **Infobulle « ? »** : un panneau qui s'ouvre et se ferme au clic (et à Échap) sur toutes les tailles d'écran,
    plutôt qu'une feuille du bas au tap sur mobile (07 § Responsive) ; à reprendre si le panneau gêne sur mobile.
    Le lien « How quality works » mène à `/help/quality`, page de T-43 (404 d'ici là).
  - **Hors périmètre** : « Popular tags » et « Showing N of total » de la maquette (Q83).
