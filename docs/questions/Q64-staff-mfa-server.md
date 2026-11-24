# Q64 — Double authentification du staff, serveur (T-18b)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - Découpage : T-18b (serveur) dépassait 400 lignes ; scindée en T-18b (TOTP côté serveur), T-18d (pages, seed, E2E) et T-18e (réauthentification, alerte aux admins, `admin:promote`, `admin:reset-mfa`). T-18c dépend de T-18d et T-18e.
  - TOTP RFC 6238 aux réglages lus par toutes les applications (HMAC-SHA-1, 6 chiffres, 30 s), tolérance d'un pas de part et d'autre, écrit avec WebCrypto (aucune dépendance) ; un pas déjà accepté est refusé ensuite (rejeu) grâce à la colonne `users.mfa_last_step` (migration expand).
  - Trois routes de 03 : `setup` (nouveau secret, remplace un secret en attente, 403 une fois activé), `verify` (premier code, renvoie les 10 codes de secours une seule fois), `challenge` (code TOTP ou code de secours, même champ `code`). Chacune ouvre une nouvelle session marquée `mfa_verified_at` et révoque la précédente.
  - Codes de secours : 10 × 10 caractères base32 (`xxxxx-xxxxx`, 50 bits), casse, espaces et tirets ignorés à la saisie ; pas de régénération ni d'invitation à reconfigurer après usage.
  - Session staff avant le TOTP : garde l'accès membre (seuls `requireRole` et donc les routes de modération et d'admin exigent le TOTP, raison `mfa_required`).
  - Sessions staff de 12 h comptées depuis leur ouverture (sans glissement), vérifiées à chaque requête.
  - Blocage : 5 échecs / 15 min par compte en fenêtre fixe (comme la connexion) ; l'alerte aux admins viendra avec T-18e.
  - Clé : SHA-256 de `MFA_ENCRYPTION_KEY` (32 caractères minimum), valeur stockée `v1.<iv>.<chiffré>` ; avec les fournisseurs factices (local, previews), une clé fixe non secrète.
