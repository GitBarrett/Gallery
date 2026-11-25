# Q82 — Grilles de la galerie : serveur (T-30a)

- **Statut** : Tranché — Adrien, 25/11/2026 (options appliquées retenues)
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - « Populaire » = le plus de likes, puis le plus récent ; « Téléchargements » = le plus de téléchargements HD,
    puis le plus récent. Les compteurs `likes_count` et `downloads_count` sont ajoutés aux captures, à 0 jusqu'aux
    likes (T-40) et au téléchargement HD (T-34) : ces deux tris donnent l'ordre de récence d'ici là.
  - « Moment de la journée » : déduit de l'heure en jeu saisie à l'upload (facultative) par plages fixes — Aube
    05:00–08:59, Jour 09:00–16:59, Crépuscule 17:00–20:59, Nuit 21:00–04:59. Une capture sans heure n'apparaît
    pas quand ce filtre est choisi.
  - « Qualité minimale » : convertie en nombre de likes avec les seuils courants de `site_settings` (Poor = tout).
  - Filtre de zone : zones du dictionnaire seulement ; une zone libre (non encore validée, US-57) n'est pas
    filtrable et la tuile n'affiche pas de zone.
  - Sans `version`, la grille couvre toutes les versions non archivées (pour la home, T-32) ; une version
    inconnue ou archivée répond 404, une zone inconnue ou un curseur altéré 400.
  - Les captures d'un compte banni ou en cours de suppression sont exclues de la grille.
  - Pas de limite de débit sur cette lecture publique (comme les autres lectures publiques, mises en cache 60 s
    en bordure) ; à revoir si l'analyse des journaux montre du scraping.
