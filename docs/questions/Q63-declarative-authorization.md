# Q63 — Autorisation déclarative (T-18a)

- **Statut** : À valider — Adrien (23/11/2026)
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - US-55 n'a pas de critère sur l'autorisation déclarative : les tests portent l'identifiant `US-55` sans numéro (aucun critère ajouté à 04, `test:trace` n'en exige donc aucun).
  - `requireMember` n'est pas une fonction : c'est le `requireContext(event)` de la route (401), comme aujourd'hui ; les autres politiques (`requireVerified`, `notSanctioned`, `requireRole`, `requireOwner`) sont des fonctions pures du domaine `identity`, exposées par son `index.ts`. `notSanctioned` lit le statut du compte (pas encore de table de sanctions) ; `updateProfile` l'utilise pour la bio d'un membre suspendu.
  - Inventaire des routes dans `tests/authorization-matrix.ts` (code de test, rien n'est ajouté au code de production) : accès `public` ou `member` et ligne de l'annexe B. Le test d'architecture vérifie que chaque fichier de `server/api` et `server/routes/auth` y figure, qu'une route `member` appelle `requireContext(event)` et pas une route `public`, et que la ligne existe dans l'annexe B. Les routes `/__test/*` (previews seulement) n'y sont pas.
  - Matrice générée : chaque route appelée en visiteur (401 `UNAUTHENTICATED` pour une route `member`, autre chose pour une route `public`) et en membre (ni 401 ni 403), avec un corps vide (un 400 reste admis). Colonnes modérateur, admin et MFA avec T-18b et T-18c, colonne propriétaire (404 chez autrui) avec les premières ressources partagées (T-21).
