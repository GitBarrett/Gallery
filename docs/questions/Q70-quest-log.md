# Q70 — Cloche et Quest log (T-23b)

- **Statut** : Tranché — Adrien, 25/11/2026 (options appliquées retenues)
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Taille du journal** : les 50 notifications les plus récentes, sans pagination ni « Load more » (rétention de
    6 mois, peu de notifications par membre au lancement). Le compteur de la cloche compte toutes les non lues.
  - **Today / Earlier** : jour local du navigateur.
  - **Lecture unitaire** : suivre le lien d'une notification la marque lue ; pas de bouton « marquer comme lu » par
    ligne.
  - **Filtre « All / Unread · N »** de la maquette : repris, côté client, sur la liste chargée.
  - **Compteur** : « 99+ » au-delà de 99 ; rafraîchi au chargement, toutes les 60 s onglet visible et au retour sur
    l'onglet ; une erreur (hors ligne) garde la dernière valeur. Sur mobile, le compteur est sur l'onglet
    Notifications de la barre du bas (absent quand Contests le remplace, US-67.1).
  - **Textes et liens par type** : like et commentaire → la capture (`/p/{id}`), abonné → son profil, décision sur
    une capture → la capture (échec du traitement → `/upload`), décision sur l'avatar → `/settings`, concours →
    `/contests` (pas encore de nom de concours : textes génériques). Le texte du commentaire n'est pas repris.
  - **Membre ou capture disparus** (compte supprimé ou banni, capture supprimée) : la notification n'est plus
    affichée ; un like groupé ne compte plus le membre disparu.
  - **Vignette** de la maquette : absente tant que les images ne sont pas servies (T-25a).
  - **Préférences (Q69)** : les interrupteurs sont sur `/notifications`, à côté du journal comme sur la maquette, et
    dans `/settings` ; enregistrés à chaque changement. Le récap email hebdomadaire de la maquette est v1.x (US-36),
    non affiché.
