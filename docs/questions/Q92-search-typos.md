# Q92 — Fautes de frappe et recherche sans résultat (T-33c)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Quand corriger** : seulement quand la requête ne trouve rien sur sa première page. La requête est alors remplacée
    par le nom de zone (anglais ou français, zones actives) ou de tag le plus proche (trigrammes, similarité ≥ 0,3,
    ADR-007), à condition que ce nom trouve des captures ; la réponse donne `corrected` (« Showing results for … »).
    Une requête qui trouve au moins une capture n'est jamais corrigée, même si un nom plus proche existe.
  - **Pas les alias** ni les titres de captures parmi les noms proches : seulement les noms de zones et les tags.
  - **Sans résultat** : jusqu'à 3 suggestions (les noms proches), 8 tags populaires (ceux du plus grand nombre de
    captures publiques), 12 dernières captures publiques toutes versions confondues, sans filtre de version ni de
    qualité.
  - **Tags populaires** : comptés à chaque recherche vide, sans cache (raccourci noté dans le code).
