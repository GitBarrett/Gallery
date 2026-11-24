# Q67 — Demande d'upload (T-21)

- **Statut** : Tranché — Adrien, 24/11/2026
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Quota de 20 uploads « sur les dernières 24 h »** (US-10.5) : compté par le limiteur exact existant (`rate_limit_counters`, T-05c), en fenêtre fixe d'un jour alignée sur minuit UTC. Le 429 donne l'attente jusqu'à minuit UTC (`Retry-After`). Conséquence : jusqu'à 40 uploads possibles de part et d'autre de minuit. Chaque demande d'URL compte, même si l'upload n'est jamais terminé. Une fenêtre glissante exacte demanderait de compter les captures en base (et une capture supprimée libérerait alors du quota).
  - **« 3 simultanés »** (08 § 8) : demandes d'URL du membre non terminées (`complete` pas encore appelé) depuis moins de 10 min, durée de vie de l'URL présignée. La 4e est refusée en 429 avec `Retry-After: 600` (majorant). Une demande abandonnée libère sa place au bout de 10 min.
  - **20 Mo** = 20 000 000 octets (lecture décimale, la plus petite des deux) ; limite partagée client et serveur (`shared/domain/capture-file.ts`).
  - **Corps de `complete`** : titre (1 à 100 caractères après espaces retirés) et version du jeu (slug de `GET /api/game-versions`). Les tags, la zone, la description et les métadonnées arrivent avec le formulaire (T-26a), en champs ajoutés au contrat ; le filtre d'insultes du titre (US-11.5) aussi.
  - **Objet absent, d'une autre taille ou d'un autre type** à `complete` : 422 `UNPROCESSABLE` avec `details.reason` = `missing`, `size` ou `type` ; l'objet est supprimé sauf s'il est absent ; la capture reste incomplète, puis le nettoyage horaire la supprime au bout de 24 h. Le client redemande une URL (03 § Pipeline 2).
  - **Idempotence de `complete`** : par construction (mise à jour conditionnelle) ; un second appel répond 200 à l'identique sans republier `photo-process`. L'en-tête `Idempotency-Key` est accepté sans être stocké.
  - **Orphelins** (US-10.7) : supprimés sans notification ni audit, 100 par passage du cron horaire.
