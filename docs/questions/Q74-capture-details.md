# Q74 — Détails d'une capture côté serveur (T-26d)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Découpage** : T-26a dépassait ≈ 800 lignes (le serveur ne recevait que titre et version) ; le serveur des détails
    devient T-26d, faite avant le formulaire. T-26a garde son numéro, les renvois de Q37, Q67 et Q73 restent valables.
  - **Légende** (maquette, 140 caractères) : absente du modèle de données ; rangée dans `photo_metadata.caption`.
    Description (1000) et texte alternatif (150, US-75.3) dans `photos`, comme le prévoit 03.
  - **Personnage** : un seul champ libre (« Character » de la maquette, 100 caractères) ; classe et race du modèle de
    données attendront un champ dans le formulaire.
  - **Heure en jeu** : `HH:MM` (00:00 à 23:59), facultative. Réglages graphiques : texte libre, 100 caractères.
  - **Filtre d'insultes** : titre (US-11.5) et tous les autres textes libres (description, alt, légende, zone libre,
    réglages, personnage) ; le premier champ refusé est rendu (`details.field`, raison `insult`).
  - **Tags** : 10 au plus après dédoublonnage ; créés dans le catalogue avant la transaction de la complétion (un tag
    créé pour une complétion qui échoue reste, inutilisé) ; le libellé est la forme normalisée.
  - **Zone** : un slug du dictionnaire (zone active, sinon 400 `unknown`) ou une zone libre (2 à 100 caractères),
    jamais les deux. La zone libre est rangée sur la capture ; la file de validation (US-57) les lira (index dédié),
    sans ligne `pending` créée dans `zones` pour l'instant.
