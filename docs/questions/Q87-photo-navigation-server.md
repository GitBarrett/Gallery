# Q87 — Navigation entre captures : serveur (T-31b)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Découpage** : T-31b devient le serveur (`GET /api/photos/{id}/related`) ; les boutons, le swipe, les flèches du
    clavier, le bloc de miniatures et la feuille du bas au toucher passent dans T-31d.
  - **Précédent / suivant** : dans la grille de la version de la capture, du plus récent au plus ancien, sans filtre
    (ni zone, ni tri choisi sur la PLP) : « précédent » = la capture publiée juste après, « suivant » = celle publiée
    juste avant ; rien aux deux bouts (pas de boucle).
  - **Bloc « More from »** (4 miniatures au plus, les plus récentes d'abord, jamais la capture affichée) :
    - l'auteur a au moins 2 autres captures : les siennes seulement ;
    - une seule : elle, puis « Similar captures » de la même zone (toutes versions) puis de la même version, jusqu'à 4
      (US-70.1) ;
    - aucune : « More from {zone} » (autres captures de la même zone, toutes versions), sinon « Latest in {version} »,
      sinon pas de bloc (US-70.2) ;
    - une capture sans zone du dictionnaire (zone libre non validée) saute l'étape de la zone.
  - **Une seule route** pour la navigation et le bloc, mise en cache 60 s en bordure comme les autres lectures
    publiques : une capture masquée peut rester voisine ou miniature quelques minutes (Q85).
