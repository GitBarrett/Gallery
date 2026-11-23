# Questions ouvertes (à partir de Q62)

Une question par fichier, `Qnn-slug.md`, pour que deux PR n'éditent jamais les mêmes lignes. Les questions Q1 à Q61
restent dans le tableau de `docs/09-questions-ouvertes.md`.

Gabarit :

```markdown
# Qnn — Titre (T-xx)

- **Statut** : À valider — Adrien | Tranché — Adrien, JJ/MM/AAAA
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - …
```

Quand Adrien tranche, le statut change dans la PR de la tâche suivante, jamais par un commit ajouté à une PR déjà
ouverte (qui relancerait toute sa CI).
