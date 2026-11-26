# Q93 — Écran de recherche (T-33b)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Autocomplétion** : sur le champ de la page `/search` seulement ; le champ de l'en-tête (≥ 768 px) reste un simple
    formulaire qui ouvre `/search?q=…`. Suggestions dès 2 caractères (comme à l'upload), 150 ms après la frappe : jusqu'à
    5 zones (nom dans la langue du visiteur) puis 5 tags. Choisir une suggestion lance la recherche de ce nom (le moteur
    reconnaît noms et alias, US-21.4), pas un filtre par zone.
  - **Les 300 ms (p95) de US-21.3** ne sont pas mesurés en E2E (une preview n'est pas un test de charge) : à lire dans
    les analytics.
  - **Filtres** : version du jeu (toutes par défaut), qualité minimale avec son « ? », tri (pertinence par défaut,
    récence, likes) ; dans l'URL (`q`, `version`, `quality`, `sort`), valeurs par défaut omises. Pas de filtre zone ni
    moment de la journée (le moteur ne les prend pas).
  - **Faute de frappe** : « Showing results for {nom} » au-dessus des résultats ; pas de lien « Rechercher plutôt … »
    (l'API ne permet pas de forcer la requête d'origine).
  - **Sans résultat** : le message, puis « Did you mean » (liens), les tags populaires (liens), les dernières captures ;
    seulement les blocs non vides.
  - **Sans texte** : une invite (« Type a zone, a tag… »), aucune requête au serveur.
  - **Version inconnue ou archivée dans l'URL** : page 404, comme la galerie.
  - **Page** : titre « {requête} — Search », pas de `noindex` propre (les previews le sont déjà).
