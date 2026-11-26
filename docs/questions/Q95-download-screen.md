# Q95 — Téléchargement HD : écran (T-34b)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Place du bouton** : « Download original · {taille} MB » en tête de la colonne de détails ; sous 768 px, collé en bas
    au-dessus de la barre d'onglets (07 § Responsive : barre d'actions collante). Like, Share et Collect viendront dans
    cette barre avec leurs tâches. La taille est celle de l'original nettoyé.
  - **Reprise après connexion (US-23.2)** : un visiteur est envoyé vers la connexion avec le retour
    `/p/{id}?download=1` ; revenu sur la page connecté, le téléchargement part une fois et `download=1` est retiré de
    l'URL (un rechargement ne relance rien).
  - **Q18 (fond d'écran au format WebP sans perte)** : non vérifiable ici, il faut des appareils réels. Option appliquée :
    un seul bouton (l'original tel que stocké, WebP sans perte quand il a été converti), pas de « Download as PNG ».
    **Action humaine** : poser un original WebP comme fond d'écran sur Windows, macOS, iOS et Android ; si l'un
    refuse, ajouter le bouton PNG converti dans le navigateur (proposition de Q18).
  - **Ligne « Use: download the original as a wallpaper. »** de la maquette : laissée de côté, comme le nombre de vues
    (Q86).
