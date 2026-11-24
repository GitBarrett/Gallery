# Q69 — Module notifications (T-23a)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Écran des préférences** (US-07.5) : aucune tâche ne prévoit les interrupteurs dans `/settings`. T-23a livre
    l'API (`PATCH /api/me` avec `notificationPrefs`, seuls les types envoyés changent) ; les interrupteurs et leur
    lecture (ajout de `notificationPrefs` à `GET /api/me/account`) sont proposés dans T-23b, la tâche front des
    notifications.
  - **Types désactivables** : likes, commentaires, abonnés, concours (US-35.4). Les décisions de modération et les
    paliers de qualité ne se désactivent pas (US-35.4 ne les cite pas parmi les préférences).
  - **Valeur par défaut** : tout est activé ; seul un `false` enregistré coupe un type.
  - **Regroupement des likes** (US-35.2) : un like rejoint la notification « like » de la même capture créée moins
    d'une heure avant ; la fenêtre part du premier like, pas du dernier. Un même membre ne compte qu'une fois
    (unlike puis like). La notification regroupée redevient non lue.
  - **Contenu stocké** : uniquement des identifiants (membre, capture, commentaire, concours). Pseudos et titres sont
    lus à l'affichage (T-23b) : un compte supprimé disparaît de lui-même des notifications des autres, sans réécriture.
  - **Destinataire supprimé ou introuvable** : l'événement est ignoré, sans erreur ni DLQ.
  - **6 mois** (US-35.5) : même jour, 6 mois calendaires plus tôt (UTC), au passage du cron quotidien.
