# Q68 — Traitement des captures (T-22b)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Statut en fin de traitement, avant la modération automatique** : T-24 (Sightengine) dépend de T-22b, donc
    l'appel à la modération (fin de US-14.1) ne peut pas encore exister. Une capture traitée passe en
    `pending_review` : aucune capture n'est publiée sans contrôle. T-24 remplacera ce statut fixe par la décision des
    seuils (`published`, `pending_review` ou `rejected`).
  - **Notification de l'auteur** (US-14.3, fin de US-10.3) : le module `notifications` arrive avec T-23a, après T-22b.
    Publier l'événement dès maintenant enverrait des messages sans consommateur vers la DLQ de `notifications`.
    US-14.3 et l'appel à la modération passent donc dans T-24, qui notifie déjà l'auteur (plan mis à jour).
  - **Fichier refusé au traitement** (octets magiques, format lu par `info()` différent du type déclaré, dimensions
    hors limites, fichier mal formé, orientation EXIF ≠ 1) : la capture passe en `failed`, comme après les retries
    épuisés (US-10.8). `rejected` reste réservé à la modération. Tous les objets de la capture sont supprimés
    (`incoming/`, `originals/`, `variants/`) ; la ligne reste visible dans « My captures » (T-25b), et l'auteur
    recommence avec un nouvel upload. Aucun motif n'est stocké (pas de colonne).
  - **Erreur du binding Images** : `info()` ou une transformation qui échoue est traitée comme une erreur passagère.
    Le binding ne distingue pas clairement « fichier indécodable » et « panne ». Un fichier indécodable aboutit à
    `failed` après 4 tentatives au lieu d'une : même résultat, quelques minutes plus tard, et une alerte DLQ.
  - **« Réessayé 3 fois »** (US-10.8) : première livraison + 3 retries (`max_retries = 3` de `wrangler.toml`). La
    4e tentative en échec passe la capture en `failed` avant que le message parte en DLQ (alerte). Aucun consommateur
    de DLQ n'est nécessaire.
  - **Luminance** (07-design § Texte sur image 4) : luminance relative WCAG moyenne (sRGB linéarisé,
    0,2126 R + 0,7152 G + 0,0722 B), de 0 à 1, sur le quart bas-gauche et le quart haut-droite de la vignette 64 px.
  - **Taille et dimensions enregistrées** : `photos.bytes` devient la taille de l'original nettoyé (celle du
    téléchargement HD) ; `width` et `height` sont celles lues par `info()`, à la place des valeurs déclarées.
