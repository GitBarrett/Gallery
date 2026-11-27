# Q105 — États vides complets (T-44)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Compteurs sous 10** (likes, téléchargements, commentaires) : jamais affichés, partout ; le bouton Like dit
    « Like » sans nombre, la section des commentaires « Comments » sans nombre.
  - **Badge « New »** : sur la tuile d'une capture de moins de 10 likes publiée il y a moins de 7 jours ; après, la
    tuile ne montre ni nombre ni badge.
  - **Profil sans capture** : pour soi, le bouton « Upload a capture » (07) ; pour les autres, « No captures yet ».
  - **Test « sur base vierge »** : les previews partagent leur base entre les tests E2E qui publient en parallèle ; les
    replis sont vérifiés sur une version laissée vide (Classic progression, US-70.5) et par les tests de composants.
  - **Hero de la home** : fixe (Q99), jamais vide.
