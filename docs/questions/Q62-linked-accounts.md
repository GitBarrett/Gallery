# Q62 — Comptes liés (T-17e)

- **Statut** : À valider — Adrien (23/11/2026)
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - Section « Comptes liés » dans `/settings` (pas de maquette des réglages) : Google et Battle.net, chacun « Non lié » ou avec un bouton « Délier » ; pas de bouton « Lier » dans les réglages, la liaison reste celle de la connexion (US-02.3).
  - Fournisseurs liés lus par `GET /api/me/account` (champ `providers`), sans nouvelle route.
  - Moyens de connexion comptés : un mot de passe (compte avec email et mot de passe) et chaque fournisseur lié ; la déliaison du dernier est refusée en 403 `last_sign_in_method`, avec un message qui renvoie vers « Mot de passe oublié ? » ou la liaison d'un autre compte.
  - Fournisseur non lié au compte : 404 ; fournisseur inconnu : 400.
  - Vérification et suppression dans une même transaction (deux déliaisons simultanées ne passent pas toutes les deux).
  - Pas de limite de débit (action rare, sur ses propres données, sans envoi d'email) ; sessions conservées ; email inchangé ; pas d'email de notification.
  - E2E : le compte Google sans mot de passe du parcours OAuth voit Google lié et ne peut pas le délier ; la déliaison réussie est vérifiée en intégration et en composant (un second fournisseur n'est pas liable depuis l'interface).
