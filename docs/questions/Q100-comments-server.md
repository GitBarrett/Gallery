# Q100 — Commentaires : serveur (T-41a)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Découpage** : T-41a (serveur), puis T-41b (section de la page photo).
  - **Filtre d'insultes** : la liste locale EN / FR des pseudos (`hasInsult`), en attendant Q8 ; une édition repasse
    le filtre.
  - **Ordre** : les plus récents d'abord, par pages de 30 (60 au plus) ; un nouveau commentaire apparaît en tête.
  - **Turnstile** : demandé à chaque commentaire d'un compte de moins de 24 h (formulaire `comment`).
  - **Limite de 10 / 10 min** : chaque commentaire accepté par les autres règles compte ; l'édition et la suppression
    ne sont pas limitées.
  - **Notification** : à l'auteur de la capture pour un nouveau commentaire, pas pour le sien, ni pour une édition.
  - **Captures commentables** : celles que montrent les grilles ; les autres sont introuvables (404), liste comprise.
  - **Commentaires masqués** (`hidden`, modération T-50) et ceux des comptes bannis ou en suppression : absents de la
    liste.
  - **Lecture** : `GET …/comments` jamais en cache (`no-store`), pour qu'un commentaire apparaisse aussitôt.
  - **Événement analytics `comment_posted`** (03) : pas encore émis, comme les likes (Q98).
