# 08 — Sécurité de bout en bout

Ce document fait foi pour la sécurité. Toute tâche qui touche une route, un formulaire, un fichier, un secret ou des données personnelles doit cocher les contrôles de la section 10.

## 1. Actifs et menaces

| Actif | Menaces principales |
|---|---|
| Comptes et sessions | vol de session, bourrage d'identifiants, énumération, prise de contrôle via reset ou OAuth, fixation de session |
| Comptes staff (modérateurs, admins) | prise de contrôle → modération abusive, fuite de données |
| Captures et originaux | accès aux originaux sans autorisation, fichiers piégés (polyglottes, bombes de décompression), contenu illicite |
| Contenus texte (titres, commentaires, bios, bug reports) | XSS stockée, injection Markdown/mentions vers GitHub, spam |
| Données personnelles (emails, IP, comportement) | fuite, conservation excessive, transferts non encadrés |
| Compteurs, classements, concours | fraude aux likes (multi-comptes), manipulation des scores |
| Budget (fournisseurs facturés à l'usage) | abus d'upload, de transformations, de modération, d'emails (déni de portefeuille) |
| Chaîne de livraison | dépendance compromise, secret commité, action CI malveillante |

Analyse STRIDE par flux à mettre à jour à chaque nouvelle fonctionnalité exposée (gabarit en annexe A).

## 2. Périmètre réseau (Cloudflare)
- HTTPS obligatoire, HSTS `max-age=63072000; includeSubDomains; preload`, TLS ≥ 1.2.
- **WAF selon le plan de zone** (vérifié 11/2026) : le plan Free n'offre que le *Free Managed Ruleset* ; le *Cloudflare Managed Ruleset* et l'*OWASP Core Ruleset* exigent le plan Pro (20 $/mois en annuel). Lancement en Free ; passage en Pro à l'ouverture publique si le budget le permet, au plus tard à 20k MAU ou au premier incident (`05-finops.md`) ; OWASP en mode journalisation d'abord (faux positifs possibles sur les uploads), puis bloquant sur `/api/*` et `/auth/*`.
- **Règles de limitation Cloudflare (par IP), en première ligne** : le plan Free n'en permet qu'**une**, sur 10 s : `/api/auth/*` 10 requêtes / 10 s. En Pro (2 règles, 60 s) : ajout de `/api/*` mutations 120 req/min. Toutes les autres limites sont appliquées dans le Worker (§ 8). `/img/*` n'a pas de règle dédiée (servi depuis le cache, coût borné par ADR-012).
- Bot Fight Mode activé (il ne se contourne pas par règle WAF en Free : la sonde de disponibilité vise `/api/health` et doit être vérifiée après activation) ; Turnstile sur inscription, connexion après échecs, reset, renvoi de vérification, liste d'attente, bug report, premiers commentaires d'un compte récent.

## 3. Authentification et sessions
- **Mots de passe** : 10 à 128 caractères, vérification HIBP par k-anonymat (préfixe SHA-1 de 5 caractères, jamais le mot de passe), hachage **Argon2id** (m = 19 Mio, t = 2, p = 1) ou scrypt (N = 2^17) si Argon2 est indisponible sur Workers (Q5) ; comparaison en temps constant.
- **Sessions** : cookie scellé `nuxt-auth-utils` contenant uniquement un identifiant aléatoire de 256 bits ; table `sessions` vérifiée à chaque requête (révocation immédiate possible) ; `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, préfixe `__Host-` ; durée 30 jours glissants, 12 h pour les sessions staff ; **nouvel identifiant à chaque connexion et changement de privilège** (anti-fixation).
- **Révocation** : déconnexion, reset ou changement de mot de passe (toutes les sessions sauf la courante), bannissement, suppression de compte, rétrogradation de rôle.
- **OAuth** : flux « authorization code » côté serveur (client confidentiel, secret jamais exposé), `state` aléatoire à usage unique lié à la session, et PKCE (`S256`) lorsque le fournisseur le prend en charge (Google : oui ; Battle.net : non documenté, `state` seul) ; `redirect_uri` exactes déclarées chez les fournisseurs ; jamais de fusion automatique sur email (US-02.3) ; l'email Google n'est considéré vérifié que si `email_verified = true`.
- **Énumération** : messages identiques pour inscription, connexion et reset ; temps de réponse homogénéisé (travail de hachage effectué même si le compte n'existe pas).
- **Verrouillage** : 5 échecs / 15 min → Turnstile ; 20 échecs / h → blocage 1 h du mot de passe pour ce compte + email au titulaire.
- **Jetons email** (vérification, reset, changement d'email, annulation de suppression) : 256 bits aléatoires, stockés hachés (SHA-256), usage unique, durée limitée (1 h reset, 24 h vérification).
- **Staff** : double authentification **TOTP obligatoire quel que soit le mode de connexion** (Google ne fournit aucune preuve exploitable que le compte a une 2FA active ; le TOTP s'ajoute donc aussi après un login OAuth) ; secret chiffré AES-GCM avec `MFA_ENCRYPTION_KEY` ; 10 codes de secours à usage unique (`mfa_recovery_codes`, hachés) ; `sessions.mfa_verified_at` requis pour toute route `/api/admin/*` ; perte du TOTP et des codes : réinitialisation par un autre admin ou par `pnpm admin:reset-mfa` (accès base, journalisé). **Réauthentification** (mot de passe, TOTP, ou nouveau passage OAuth) de moins de 5 min (`sessions.reauth_at`) exigée pour bannir, changer un rôle, un réglage du site, publier une version des Terms, et pour la suppression de compte d'un membre.
- **Redirections** : paramètre `redirect` accepté uniquement s'il s'agit d'un chemin relatif du site (`/^\/(?!\/)/`).

## 4. Autorisation
- **Refus par défaut** : chaque use case déclare sa politique (`requireMember`, `requireVerified`, `requireOwner`, `requireRole('moderator')`, `notSanctioned`) ; une route sans politique déclarée fait échouer un test d'architecture.
- **Contrôle de propriété** dans la couche application, jamais seulement dans l'interface ; les ressources privées d'autrui répondent 404 (pas d'information sur leur existence).
- **Statut du compte** relu à chaque requête via la session (suspension, bannissement, suppression en cours).
- **Matrice d'autorisation** (annexe B) testée automatiquement : chaque route × chaque rôle (visiteur, membre non vérifié, membre, propriétaire, suspendu, modérateur, admin).

## 5. Entrées, sorties et navigateur
- **Validation** : schémas Zod stricts (`.strict()`, longueurs max, énumérations) sur toute entrée (corps, query, params, en-têtes utilisés, messages de Queue, réponses des fournisseurs externes).
- **Base de données** : requêtes paramétrées Drizzle uniquement ; `sql` brut interdit hors `server/modules/*/infrastructure/` et toujours avec paramètres liés ; recherche full-text via `websearch_to_tsquery`.
- **Rendu** : contenus utilisateur affichés en texte (interpolation Vue) ; `v-html` interdit par règle ESLint (`vue/no-v-html` en erreur) ; aucun Markdown utilisateur.
- **En-têtes de sécurité** (toutes les réponses HTML) :
  - `Content-Security-Policy` (générée avec nonce par le module **nuxt-security**) : `default-src 'self'; script-src 'self' 'nonce-{n}' 'strict-dynamic' 'wasm-unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com https://eu-assets.i.posthog.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com https://eu.i.posthog.com https://cloudflareinsights.com https://*.ingest.de.sentry.io; frame-src https://challenges.cloudflare.com; worker-src 'self'; manifest-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests` ; domaines publicitaires ajoutés uniquement quand `features.ads` est actif ; rapport des violations vers Sentry. Avec `'strict-dynamic'`, les navigateurs récents ignorent les listes d'hôtes de `script-src` : **chaque balise script doit porter le nonce**. En conséquence, l'injection automatique de Cloudflare Web Analytics est désactivée dans le tableau de bord et la balise du beacon est ajoutée par Nuxt (avec nonce) ; idem pour Turnstile. L'hôte R2 de `connect-src` sert à l'upload direct (URL présignée). `'wasm-unsafe-eval'` autorise uniquement la compilation WebAssembly (encodeurs de la page d'upload), sans autoriser `eval` JavaScript ; les encodeurs tournent dans un Web Worker servi depuis l'origine du site (`worker-src 'self'`). Un test d'intégration vérifie qu'aucune ressource de la home, de la PLP et de la PDP n'est bloquée (console sans violation CSP).
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-site`.
- **CSRF** : `SameSite=Lax` + vérification stricte de l'en-tête `Origin` (ou `Sec-Fetch-Site: same-origin`) sur toute mutation ; les mutations ne sont jamais en GET.
- **CORS** : aucun en-tête CORS permissif ; l'API n'est consommée que par le site lui-même.
- **SSRF** : le serveur ne récupère jamais une URL fournie par un utilisateur ; les appels sortants se limitent à une liste fixe d'hôtes (Sightengine, Resend, GitHub, OAuth, HIBP, Sentry).

## 6. Fichiers et images
- **Upload** : URL présignée PUT de 10 min sur bucket **privé**, clé aléatoire générée par le serveur, signée avec `Content-Length` (≤ 20 Mo) et `Content-Type` déclarés ; aucun nom de fichier utilisateur dans les clés ; politique CORS du bucket limitée aux origines du site, à `PUT` et à `content-type` ; jeton S3 limité au bucket.
- **Vérification à `complete`** : `R2.head()` contrôle présence, taille réelle (≤ 20 Mo, égale à la taille déclarée) et type ; tout écart supprime l'objet (la signature de `Content-Length` n'est pas la seule barrière).
- **Contrôle serveur** après upload : taille réelle, octets magiques (JPEG, PNG, WebP uniquement ; TGA converti côté client ; SVG, HEIC, GIF refusés), `IMAGES.info()` (format cohérent avec les octets magiques, dimensions ≤ 7680 px et ≤ 33,2 Mpx), rejet de tout fichier que le service ne décode pas.
- **Neutralisation** : suppression des métadonnées au niveau octet (ADR-011 ; profil de couleur conservé, cf. `03-architecture.md` § Pipeline) ; les variantes affichées sont toujours réencodées par le binding Images ; l'original (seul fichier non réencodé) n'est servi qu'en téléchargement `attachment`, avec `Content-Type` fixé par le serveur et `nosniff`, jamais affiché en ligne.
- **Service** : affichage via `/img/{id}/{w}` (largeurs fixes), `Content-Type` défini par le serveur, `X-Content-Type-Options: nosniff` ; téléchargements avec `Content-Disposition: attachment`.
- **Avatars et captures de bug report** : mêmes contrôles, limites 2 Mo et 5 Mo.
- **Contenu illicite** : modération automatique avant publication (US-50) ; tout contenu signalé comme pédopornographique est retiré immédiatement, conservé hors ligne pour les autorités et signalé via PHAROS (France) ; procédure dans le runbook modération.

## 7. Données personnelles et secrets
- **Minimisation** : IP stockées uniquement sous forme de HMAC (`IP_HASH_KEY`, rotation 30 jours) ; aucune donnée personnelle dans les logs, Sentry (`sendDefaultPii: false`, filtrage des corps de requête), PostHog (identifiant pseudonyme), GitHub.
- **Chiffrement** : TLS partout ; chiffrement au repos assuré par Neon et R2 ; secrets TOTP chiffrés applicativement.
- **Rétention** : appliquée par les tâches planifiées (`03-architecture.md` § Files et tâches) et décrite dans `docs/legal/privacy.md`.
- **Suppression** : cascade complète testée (US-09.2) : base, R2, PostHog, sessions.
- **Secrets** : uniquement dans les secrets Cloudflare et GitHub Actions ; validation au démarrage ; rotation documentée (session, clés IP, clés fournisseurs) ; **gitleaks** en pre-commit et en CI ; aucun secret dans `wrangler.toml`.
- **Accès humains** : comptes Cloudflare, Neon, GitHub, Resend, Sentry protégés par 2FA ; principe du moindre privilège (token CI limité au déploiement du Worker, token de purge limité au cache de la zone).
- **Environnements non productifs** : previews derrière Cloudflare Access ; routes `/__test/*` et fournisseurs factices absents des builds de production (contrôle au démarrage et test de CI sur l'artefact de production).

## 8. Abus et budget
| Action | Limite |
|---|---|
| Inscription | 3 / h / IP |
| Connexion | 5 échecs / 15 min → Turnstile ; 20 / h → blocage 1 h |
| Renvoi de vérification, reset | 3 / h / compte, 10 / h / IP |
| Upload | 20 / 24 h / compte ; 3 simultanés |
| Like | 120 / h / compte |
| Commentaire | 10 / 10 min / compte |
| Signalement | 20 / 24 h / compte ; seuls les signalements de comptes vérifiés de plus de 7 jours et non sanctionnés comptent pour le masquage automatique (`moderation.reportsToHide`, défaut 3) — empêche trois faux comptes de masquer une capture |
| Téléchargement HD | 100 / h / compte |
| Bug report | cf. `02-specs-fonctionnelles.md` § 7 |
| Changement de pseudo | 1 / 30 jours |
| Liste d'attente (mode invitation) | 3 / h / IP, Turnstile |
| Codes TOTP et codes de secours | 5 échecs / 15 min → blocage 15 min du compte staff + alerte aux admins |

Implémentation : port `RateLimiter` avec deux adaptateurs — binding Workers Rate Limiting pour les rafales (fenêtres de 10 ou 60 s, comptées par emplacement Cloudflare, donc approximatives) et table `rate_limit_counters` (clé HMAC, fenêtre fixe) pour les fenêtres longues et toute limite qui doit être exacte (verrouillage de connexion, quotas) ; réponse 429 avec `Retry-After`. Alertes budget à 80 % par fournisseur (`05-finops.md`).

## 9. Chaîne de livraison
- Dépendances épinglées (`pnpm-lock.yaml`), Dependabot hebdomadaire, `pnpm audit --prod` bloquant sur les vulnérabilités hautes et critiques.
- CodeQL (JavaScript/TypeScript) sur chaque PR ; gitleaks ; actions GitHub épinglées par SHA ; permissions `GITHUB_TOKEN` minimales (`contents: read` par défaut).
- Branche `main` protégée : PR obligatoire, CI verte, revue (humaine ou Claude Code `/review`), pas de force-push.
- Migrations de base revues en PR, rétrocompatibles (expand → migrate → contract), jamais appliquées à la main en production.

## 10. Contrôles par tâche (Definition of Done sécurité)
Pour toute tâche qui expose une route, un formulaire ou un traitement :
- [ ] politique d'autorisation déclarée et testée (cas autorisé + cas refusé pour chaque rôle concerné) ;
- [ ] schéma Zod strict en entrée, réponse typée en sortie, erreurs au format commun ;
- [ ] limite de débit définie (section 8) ou justification écrite de son absence ;
- [ ] aucune donnée personnelle dans les logs ajoutés ;
- [ ] contenus utilisateur rendus en texte ;
- [ ] test d'IDOR : accès à la ressource d'un autre utilisateur refusé ;
- [ ] mise à jour de la matrice d'autorisation (annexe B) si nouvelle route.

## 11. Tests de sécurité automatisés
- Unitaires : politiques d'autorisation, validation de fichiers (corpus de fichiers piégés dans `tests/fixtures/malicious/` : polyglotte JPEG/HTML, PNG à dimensions déclarées géantes, SVG renommé en .png, TGA tronqué), échappement GitHub, règles de mot de passe.
- Intégration : matrice d'autorisation complète générée depuis l'inventaire des routes, rejeu de jetons, `state` OAuth invalide, CSRF (origine étrangère), en-têtes de sécurité présents.
- E2E : XSS stockée (charge utile dans titre, commentaire, bio, pseudo affichée sans exécution), session révoquée après déconnexion et reset.
- Scan dynamique **OWASP ZAP baseline** sur l'URL de preview, hebdomadaire et avant chaque mise en production (alertes « High » bloquantes).
- Revue manuelle avant ouverture publique : checklist OWASP ASVS niveau 2 (sections V2, V3, V4, V5, V12, V13).

## 12. Réponse à incident
Runbook `docs/runbooks/incident.md` (à écrire, tâche dédiée) : qualification, révocation globale des sessions (rotation de `NUXT_SESSION_PASSWORD`), rotation des clés, mode maintenance (flag `features.readonly`), notification CNIL sous 72 h si fuite de données personnelles, information des membres concernés.

---

## Annexe A — Gabarit STRIDE par flux
| Flux | Usurpation | Altération | Répudiation | Divulgation | Déni de service | Élévation de privilège | Contrôles |
|---|---|---|---|---|---|---|---|
| Upload d'une capture | session volée | fichier piégé, clé R2 devinée | — (audit) | original accessible | uploads massifs | upload au nom d'un autre | §3, §6, §8, §4 |
| Connexion OAuth | `state` forgé | code intercepté | — | email exposé | — | liaison abusive à un compte existant | §3 |
| Modération | compte staff volé | décision falsifiée | audit_log | données de signalement | file inondée | membre → modérateur | §3 MFA, §4, US-58 |
| Bug report → GitHub | — | injection Markdown/mentions | — | données perso vers GitHub | spam | — | §5, `02` §7 |

## Annexe B — Matrice d'autorisation (MVP, complète)
Une ligne par groupe de routes de `03-architecture.md` § Inventaire ; le test d'intégration génère un cas par route × rôle. « Suspendu » = membre vérifié sous sanction active. Flag désactivé → 404 pour tous ; `features.readonly` → 503 sur toute mutation sauf admin.

| Routes | Visiteur | Non vérifié | Membre | Propriétaire | Suspendu | Modérateur | Admin |
|---|---|---|---|---|---|---|---|
| Lectures publiques : `GET /api/photos`, `/api/photos/{id}` (publiée), `/related`, `/comments`, `/api/users/*`, `/api/home`, `/api/settings/public`, `/api/game-versions`, `/api/zones/suggest`, `/api/tags/suggest`, `/api/search`, `/api/usernames/{name}/availability`, `/img/*` dont `og.jpg` (publiées), `/avatar/*`, sitemap, robots, health | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Auth sans session : `signup`, `signin`, `password/*`, `verify-email`, `email/confirm`, `deletion/cancel`, `GET /auth/*`, `oauth/complete`, `POST /api/waitlist` | ✓ (Turnstile, § 8) | ✓ | ✓ | — | ✓ (banni : refusé) | ✓ | ✓ |
| `signout`, `resend-verification`, `reauth` | 401 | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `POST /api/auth/mfa/*` | 401 | 403 | 403 | — | 403 | ✓ | ✓ |
| Compte : `GET/PATCH /api/me`, `/api/me/sessions*`, `email`, `password`, `oauth/*`, `terms/accept` (v1.x, T-70), `decisions`, `GET /api/me/photos`, `POST /api/me/deletion` | 401 | ✓ | ✓ | — | ✓ (PATCH bio : 403) | ✓ | ✓ (dernier admin : suppression 409) |
| `POST /api/me/avatar-upload-url`, `avatar/complete` | 401 | 403 | ✓ | — | 403 | ✓ | ✓ |
| Capture non publiée : `GET /api/photos/{id}`, `/img/{id}/{w}?preview=1` | 404 | 404 | 404 | ✓ | ✓ | ✓ (MFA) | ✓ (MFA) |
| `POST /api/photos/upload-url`, `/complete` | 401 | 403 | ✓ | — | 403 | ✓ | ✓ |
| `PATCH /api/photos/{id}` | 401 | 403 | 403 (404 si non publiée) | ✓ | 403 | 403 (passer par `/api/admin/moderation`) | 403 (idem) |
| `DELETE /api/photos/{id}` | 401 | 403 | 403 (404 si non publiée) | ✓ | ✓ | 403 (idem) | 403 (idem) |
| `POST /api/photos/{id}/download` | 401 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `PUT/DELETE /api/photos/{id}/like` | 401 | ✓ | ✓ | 403 (auto-like) | 403 | ✓ | ✓ |
| `POST /api/photos/{id}/comments` | 401 | 403 | ✓ | ✓ | 403 | ✓ | ✓ |
| `PATCH /api/comments/{id}` | 401 | 403 | 403 | ✓ (auteur, < 15 min) | 403 | 403 | 403 |
| `DELETE /api/comments/{id}` | 401 | 403 | 403 | ✓ (auteur du commentaire ou de la capture) | ✓ (idem) | 403 (passer par la modération) | 403 (idem) |
| `/api/notifications*` (liste, compteur, lecture) | 401 | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `POST /api/reports` | 401 | 403 | ✓ | 403 (son propre contenu) | 403 | ✓ | ✓ |
| `POST /api/appeals` (v1.x, T-71) | 401 | ✓ | ✓ | ✓ (décision le concernant, sinon 404) | ✓ | ✓ | ✓ |
| `POST /api/bug-reports` | ✓ (« I can't sign in » seule) | ✓ (« I can't sign in » seule) | ✓ | — | ✓ | ✓ | ✓ |
| `/api/admin/moderation/*`, `/appeals/*` (v1.x, T-71), `/reports/*`, `/users` (recherche), `/sanctions/*` (avertissement, suspension) | 401 | 403 | 403 | 403 | 403 | ✓ (MFA ; recours : jamais l'auteur de la décision) | ✓ (MFA) |
| `/api/admin/sanctions/*` (bannissement, levée) | 401 | 403 | 403 | 403 | 403 | 403 | ✓ (MFA + réauth) |
| `/api/admin/users/{id}/role`, `/settings`, `/legal` (v1.x, T-70) | 401 | 403 | 403 | 403 | 403 | 403 | ✓ (MFA + réauth) |
| `/api/admin/game-versions/*`, `/zones/*`, `/invites/*`, `/waitlist`, `/audit`, `/bug-reports/*` | 401 | 403 | 403 | 403 | 403 | 403 | ✓ (MFA) |
| `/__test/*` | 404 en production pour tous ; preview uniquement (derrière Access) | | | | | | |
