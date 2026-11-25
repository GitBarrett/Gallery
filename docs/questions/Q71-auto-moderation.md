# Q71 — Modération automatique (T-24)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Score retenu** : le maximum de nudité explicite (`sexual_activity`, `sexual_display`, `erotica` de nudity-2.1),
    de `gore.prob` (gore-2.0) et de chaque symbole ou geste offensant (offensive-2.0). Les classes « suggestives »
    (maillot de bain, décolleté…) ne comptent pas. La réponse brute complète est historisée.
  - **Coût** : les 3 modèles de 02-specs § 6 font 3 opérations Sightengine par capture, contre 2 dans 05-finops.
  - **Pannes (US-50.4)** : 3 appels dans le traitement (attente de 1 s puis 2 s), puis `pending_review` sans score,
    décision historisée avec le motif `provider_unavailable`. Une panne du fournisseur ne fait jamais passer une
    capture en `failed`. Clés Sightengine absentes en production : même effet (revue manuelle).
  - **Historique** : une décision automatique par capture ; un message rejoué remplace la précédente (la dernière
    fait foi, avec ses scores bruts pour un éventuel recours, US-52.6).
  - **Refus (US-50.1)** : l'original nettoyé part dans `trash/originals/{id}`, les variantes sont supprimées. Motif
    et recours dans la notification : « refusée par la modération automatique (contenu sensible), contestable sous
    6 mois, voir les conditions », lien « Appeal » vers `/terms` (recours par email au MVP).
  - **Revue (US-50.2)** : la « file de modération » est le statut `pending_review` ; l'écran est T-58.
  - **Publication** : `published_at` posé à la décision automatique ; `moderation_score` gardé sur la capture.
  - **Fournisseur factice** (local, tests, previews) : il note la capture d'après son **titre** (`…_nsfw` → 0,95,
    `…_review` → 0,6, `…_down` → panne), le nom du fichier n'étant pas conservé.
