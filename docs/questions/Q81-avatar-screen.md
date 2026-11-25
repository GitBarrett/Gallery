# Q81 — Écran de l'avatar (T-28b)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - Recadrage : le **carré central** de l'image est gardé automatiquement, sans réglage par le membre (ni
    déplacement ni zoom) ; un aperçu le montre avant l'envoi. Un recadrage manuel pourra venir ensuite.
  - Le navigateur réduit ce carré à **512 px** au plus et le réencode en **JPEG** (qualité 0,9) : fichier léger, sans
    métadonnées ; une image dont le petit côté fait moins de 128 px est refusée dans la page.
  - Après l'envoi, un message indique que l'avatar est en cours de vérification ; l'avatar affiché change au
    chargement d'une page suivante (pas de rafraîchissement automatique), et la notification de modération
    annonce le résultat.
  - L'avatar remplace l'icône « profil » de l'en-tête (32 px, coins arrondis comme sur le profil) ; sans avatar,
    l'initiale du pseudo s'affiche à sa place, comme sur le profil. Le profil de la barre d'onglets mobile garde son
    icône.
  - Pas de bouton « retirer mon avatar » (non demandé par US-07.6).
