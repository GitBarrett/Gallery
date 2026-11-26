# Q98 — Likes : serveur (T-40a)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Découpage** : T-40a (serveur), puis T-40b (bouton de la page photo).
  - **Limite de 120/h** : chaque demande de like compte, même refusée (sa propre capture) ou déjà comptée ; un unlike
    n'est pas limité.
  - **Unlike** permis à tout membre, même sanctionné (il retire seulement le sien) ; le like demande un compte actif
    (matrice : suspendu ou banni 403), vérifié ou non (US-08.2).
  - **Captures likables** : celles que montrent les grilles (publiées, version non archivée, auteur ni banni ni en
    suppression) ; les autres sont introuvables (404).
  - **Palier notifié** : le plus haut palier atteint est retenu (`quality_tier_notified`), jamais abaissé ; un
    changement de seuils par l'admin ne notifie rien rétroactivement, le palier suivant atteint par un like le fait.
  - **Événement analytics `photo_liked`** (03) : pas encore émis, comme `photo_downloaded` (Q94).
  - **État « liké » du visiteur** (pour le bouton, T-40b) : à trancher en T-40b ; la page photo est en cache public,
    elle ne peut pas le porter.
