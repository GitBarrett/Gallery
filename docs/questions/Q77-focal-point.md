# Q77 — Point focal (T-26c)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Saisie** : à l'upload, sous le fichier, en touchant l'image entière ; deux curseurs (position horizontale et
    verticale, 0 à 100 %) font la même chose au clavier ; « Back to the centre » efface le point. Pas de point par
    défaut : sans choix, le centre (US-13.2).
  - **Stockage** : `photos.focal_x` et `focal_y`, de 0 à 1 depuis la gauche et le haut, envoyés avec la fin de
    l'upload, les deux ou aucun. La modification après publication arrive avec T-27 (US-13.1 « ou de modification »).
  - **Aperçu du recadrage** : la carte 16/9 de l'aperçu en direct applique le point (`object-position`). Les autres
    recadrages (grilles, hero, bannières) l'appliqueront avec leurs pages (T-30 et la home) ; `WowImage` n'est pas
    modifié tant qu'aucun écran ne recadre.
