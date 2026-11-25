# Q75 — Formulaire d'upload (T-26a)

- **Statut** : Tranché — Adrien, 25/11/2026 (options appliquées retenues)
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Zone et tags** : suggestions par listes natives (`datalist`), accessibles au clavier et aux lecteurs d'écran,
    plutôt que la liste dessinée de la maquette. Une zone saisie qui n'est pas exactement un nom (anglais ou
    français) des suggestions part comme zone libre, à vérifier (US-11.3). Un tag s'ajoute par Entrée, virgule ou
    en quittant le champ ; il est normalisé tout de suite comme le serveur le stocke.
  - **Reprise** : une URL présignée ne permet qu'un PUT complet ; « reprise » = si l'envoi échoue (réseau, URL
    expirée), une nouvelle URL est demandée une fois et l'envoi recommence, les champs restent remplis. La
    complétion porte `Idempotency-Key` (une seconde tentative ne crée rien).
  - **Étapes** « Fichier · Détails · Revue » de la maquette : un seul écran, les pastilles suivent l'avancement.
  - **Champ texte alternatif** (US-75.3, 150 caractères) ajouté sous la description, absent de la maquette.
  - **Heure en jeu** : champ heure natif (`HH:MM`).
  - **Membre non vérifié** (US-08.1) : à la place du formulaire, le titre « Verify your email », une phrase et un
    bouton vers `/verify-email`, où se trouve le renvoi du lien (Turnstile).
  - **Après « Publish »** : bandeau « Quest accepted » de la maquette avec un lien vers « My captures » ; le
    formulaire reste affiché.
  - **Consentement** : case obligatoire côté navigateur, non enregistrée (les Terms acceptées à l'inscription
    couvrent la licence) ; à stocker si un recours doit le prouver.
  - **Version du jeu** : aucune présélection, le membre choisit.
  - **TGA et fichiers de plus de 20 Mo** : refusés ici avec leur motif ; la conversion arrive avec T-26b.
