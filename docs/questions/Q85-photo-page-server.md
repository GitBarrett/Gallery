# Q85 — Page photo : serveur (T-31a)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Découpage** : T-31a devient le serveur (`GET /api/photos/{id}`) ; la page `/p/{id}`, ses métadonnées et le
    lien depuis la grille passent dans T-31c, avant la navigation (T-31b).
  - **Visibilité** : seule une capture publiée, d'une version non archivée et d'un compte ni banni ni en cours de
    suppression est rendue (la même règle que les grilles) ; tout le reste répond 404, y compris pour son auteur et
    les modérateurs : ils la voient dans « My captures » et dans les outils de modération (aperçu privé des images).
  - **Contenu** : titre, description, texte alternatif, légende, dimensions, format et taille de l'original, version,
    zone du dictionnaire (une zone libre non validée n'est pas rendue, comme sur les grilles), heure en jeu, réglages
    graphiques, personnage, tags par ordre alphabétique, auteur et son avatar, likes, téléchargements, qualité, date de
    publication. Pas de compteur de vues (aucune donnée).
  - **Cache** : 60 s en bordure (`stale-while-revalidate` 300 s), comme les autres lectures publiques : une capture
    masquée peut rester lisible quelques minutes par cette route ; la purge des images (`removeImages`) reste immédiate.
  - **Pas de limite de débit** sur cette lecture publique (comme les grilles, Q82).
