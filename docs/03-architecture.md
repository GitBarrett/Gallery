# 03 — Architecture

## Vue d'ensemble

```
Navigateur (PWA Nuxt)
   │  HTTPS
   ▼
Cloudflare (WAF, CDN, Turnstile)
   │
   ├── Worker Nuxt/Nitro ── Hyperdrive ──► Neon Postgres
   │        │
   │        ├── R2 privé (originaux + variantes)  ◄── URL présignée (upload direct navigateur, CORS)
   │        ├── Images binding        ──► variantes générées une seule fois, écrites dans R2 (ADR-012)
   │        ├── Queues ──► consommateurs : traitement image, modération, notifications, emails, feedback, purge
   │        ├── Cron Triggers ──► concours, classements, purges
   │        └── APIs externes : Sightengine, Resend, GitHub App, OAuth Google / Battle.net, Sentry
   │
   └── Navigateur ◄── /img/{photoId}/{largeur} : variante lue dans R2 + cache edge (originaux jamais publics)
```

Monolithe modulaire déployé comme un seul Worker. Le consumer de Queues est le même Worker (handler `queue`).

## Modules serveur (`server/modules/`)

Chaque module suit la structure en couches de `10-clean-architecture.md` (domain / application / infrastructure / interface).

| Module | Responsabilités | Dépend de (via ports publics) |
|---|---|---|
| identity | Comptes, sessions, OAuth, vérification email, reset, réglages, suppression, MFA staff, rôles | — |
| catalog | Versions du jeu, zones (dictionnaire, alias), tags | — |
| media | Upload présigné, pipeline de traitement, stockage R2, téléchargement, luminance, point focal | identity, catalog, moderation |
| gallery | Lecture des captures : grilles, PDP, recherche, home, sitemap, qualité | catalog, social |
| social | Likes, commentaires, follows, collections | identity |
| notifications | Création, regroupement, préférences, lecture, emails | identity |
| moderation | Modération auto, signalements, file, décisions, sanctions, recours | identity, media |
| contests | Concours, participations, score, anti-triche, badges | gallery, social, moderation |
| leaderboard | Instantanés de classement | gallery, social |
| settings | `site_settings` (seuils, hero, flags) avec cache 60 s | — |
| admin | Back-office : orchestration des autres modules, journal d'audit | tous (ports publics) |
| feedback | Bug reports → GitHub, anti-spam | identity |
| secrets | (v1.x, T-73) Quêtes secrètes : étapes, essais vérifiés par HMAC, progression, badge et titre, Hall of Seekers (US-81) | identity |

Règle : un module n'importe que l'`index.ts` public d'un autre module (ses use cases et ses types). Imports profonds interdits, vérifiés en CI (`10-clean-architecture.md` § Contrôles).

## Pipeline image

1. Client : contrôle format/poids/dimensions (règles `shared/domain` : 640 à **7680 px** sur le grand côté, ≤ **33,2 Mpx** soit le 8K 7680 × 4320, ≤ 20 Mo = limite d'entrée du binding Images) ; un fichier TGA est décodé en JS et converti en PNG sans perte dans le navigateur ; **chaîne de conversion dans le navigateur** (Web Worker, encodeurs WebAssembly libwebp et MozJPEG chargés à la demande, hors precache) pour un TGA ou un PNG de plus de 20 Mo : (a) WebP **sans perte**, sans avertissement ; (b) s'il dépasse encore 20 Mo (cas typique du 8K), JPEG qualité 95 en 4:4:4, avec avertissement ; jamais de WebP avec perte pour un original (sous-échantillonnage 4:2:0 imposé, qui dégrade textes et contours rouges) ; `canvas.toBlob` n'est pas utilisé pour l'encodage (Safari renvoie un PNG à la place du WebP, sous-échantillonnage JPEG non maîtrisable). Si la conversion échoue faute de mémoire (mobile), message « Convert this file on a computer » sans plantage de l'onglet ; puis `POST /api/photos/upload-url`.
2. Serveur : vérifie session, email vérifié, sanctions et quota ; crée la photo en `processing` ; renvoie une URL présignée PUT sur le **bucket privé** (clé de dépôt `incoming/{photoId}`, UUID v7, sans extension ; jamais servie), expiration 10 min, signée avec `Content-Length` et `Content-Type` déclarés. URL en style chemin sur `https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com` (hôte autorisé dans `connect-src`, cf. 08 § 5). Le bucket porte une **politique CORS** : origines du site (et des previews pour le bucket de preview), méthode `PUT`, en-tête `content-type`, `MaxAgeSeconds` 3600. Une URL expirée répond 403 sans en-têtes CORS (erreur illisible côté navigateur) : le client redemande une URL une fois, puis affiche l'erreur.
3. Client : PUT direct vers R2, puis `POST /api/photos/{id}/complete` avec titre, version, tags, métadonnées.
4. Serveur : `R2.head(incoming/{id})` — objet présent, taille ≤ 20 Mo et égale à la taille déclarée, `Content-Type` conforme ; sinon objet supprimé et 422 (défense en profondeur : on ne compte pas sur la seule signature de `Content-Length`). Puis publie un message `photo-process` dans la Queue (via l'outbox).
5. Consommateur `photo-process` (contrainte : **128 Mo de mémoire par isolate Workers, WASM compris** — aucun décodage complet d'image dans le Worker, cf. ADR-011) :
   - lit les premiers octets via le binding R2 (lecture partielle) : octets magiques JPEG, PNG ou WebP uniquement ;
   - `env.IMAGES.info()` sur le flux R2 : format, dimensions (640 à 7680 px, ≤ 33,2 Mpx) — un fichier que le service ne sait pas décoder est rejeté ;
   - **suppression des métadonnées au niveau octet, en flux, sans réencodage** — JPEG : segments APP1 (EXIF, XMP), APP3–APP13 (dont IPTC), APP15 et COM ; **conservés** : APP0 (JFIF), APP2 `ICC_PROFILE` et APP14 `Adobe`, indispensables au rendu exact des couleurs ; PNG : chunks `eXIf`, `tEXt`, `iTXt`, `zTXt`, `tIME` (`iCCP`, `sRGB`, `gAMA`, `cHRM` conservés) ; WebP : chunks `EXIF` et `XMP ` avec mise à jour des drapeaux `VP8X` et de la taille RIFF. Une orientation EXIF différente de 1 (absente des captures de jeu) est refusée (`UNSUPPORTED_ORIENTATION`, aussi contrôlée côté client), car la retirer ferait pivoter l'image ;
   - écriture de l'original nettoyé sous `originals/{id}` en deux passes : la première lit la structure (segments ou chunks) pour calculer la taille finale, la seconde réécrit en flux via `FixedLengthStream` (R2 exige une longueur connue pour un flux) ; puis suppression de `incoming/{id}`. L'original n'est jamais réencodé (aucune perte) ;
   - **variantes générées une seule fois et écrites dans R2 (ADR-012)** — 6 transformations par capture, jamais refacturées :
     - `variants/{id}/64.png` : décodée en JS (≈ 16 Ko de pixels, sans risque mémoire) pour la luminance des zones bas-gauche et haut-droite (cf. 07-design, contraste), puis supprimée ;
     - `variants/{id}/1200.jpg` (qualité 85) : envoyée à Sightengine (pas d'URL publique) et servie comme `og:image` ;
     - `variants/{id}/{400,800,1200,2400}.webp` (qualité 82, `fit=scale-down`) : affichage. WebP est lu par tous les navigateurs supportés ; AVIF est exclu (sortie limitée à 1 200 px par Cloudflare, encodage lent) ;
   - applique les seuils, met à jour le statut, publie l'événement (notification via outbox).
   - Les variantes sont produites une par une et écrites avant la suivante (une seule en mémoire, ≤ 1 Mo) ; un message rejoué réécrit les mêmes clés (idempotent).
6. Affichage : route Worker `GET /img/{photoId}/{w}` avec `w ∈ {400, 800, 1200, 2400}` (WebP) et `GET /img/{photoId}/og.jpg` (JPEG 1200) uniquement (toute autre valeur = 404) ; vérifie le statut de la capture (requête indexée), lit la variante dans R2 **sans transformation sur le chemin chaud**, répond `Cache-Control: public, max-age=2592000, immutable` et met en cache via l'API Cache (clé = URL exacte ; l'API Cache n'est active que sur le domaine personnalisé, pas sur `workers.dev` : les previews servent sans cache). Les variantes sont réencodées par le binding, ce qui neutralise tout contenu caché dans l'original. Seules les captures `published` sont servies publiquement. À la suppression ou au masquage : variantes déplacées dans `trash/` et purge par URL des 5 adresses de la capture. **Aperçu privé** : `GET /img/{photoId}/{w}?preview=1` sert une capture non publiée (`processing`, `pending_review`, `hidden`, `rejected`) uniquement à son auteur et aux modérateurs, avec `Cache-Control: private, no-store`. Aucune variante stockée.
7. Téléchargement HD : `POST /api/photos/{id}/download` (membre connecté) renvoie une URL GET présignée de 5 min avec `response-content-disposition=attachment`.

Pas de bibliothèque de décodage d'image dans le Worker (limite mémoire), à l'exception du décodeur PNG JS pour la vignette 64 px. Le décodage TGA se fait côté client ; toute autre transformation passe par le binding Images. Les avatars suivent le même pipeline (message `avatar-process` sur la même Queue) : variantes `avatars/{userId}/{version}/{64,128,256}.webp`, servies par `GET /avatar/{userId}/{version}/{size}` (URL changée à chaque nouvel avatar). La suppression des métadonnées est un traitement d'octets testé sur un corpus (`tests/fixtures/images`).

## Modèle de données (Drizzle, première version)

| Table | Champs clés |
|---|---|
| users | id (UUID v7), email (unique insensible à la casse, nullable si OAuth sans email), email_verified_at, password_hash (nullable), username (unique insensible à la casse), username_changed_at, avatar_key, bio, locale, role (`user`/`moderator`/`admin`), status (`active`/`suspended`/`banned`/`pending_deletion`), deletion_requested_at, terms_accepted_at, terms_version, avatar_pending_key, quality_intro_sent_at (US-71.3), notification_prefs jsonb, mfa_totp_secret_enc (chiffré AES-GCM), mfa_enabled_at, mfa_last_step (dernier pas TOTP accepté : rejeu refusé), contest_ban_until, created_at |
| donations | (v1.1, créée en T-05 avec `features.donations` désactivé) id, provider_ref (identifiant du prestataire, unique), amount_cents, currency, status (pending, succeeded, failed, canceled), badge_opt_in, created_at, confirmed_at ; aucun lien obligatoire vers un compte (don anonyme possible) ; webhook signé et idempotent |
| sessions | id_hash (SHA-256 de l'identifiant porté par le cookie scellé), user_id, created_at, last_seen_at, expires_at, revoked_at, mfa_verified_at (staff : accès `/admin` seulement si renseigné), reauth_at (actions sensibles : < 5 min), user_agent_summary ; chaque requête authentifiée vérifie la ligne (permet révocation et « déconnecter partout ») |
| oauth_accounts | id, user_id, provider (`google`/`battlenet`), provider_user_id, unique(provider, provider_user_id) — Battle.net utilise l'hôte global `oauth.battle.net` pour toutes les régions hors Chine, aucune région à stocker |
| mfa_recovery_codes | user_id, code_hash (SHA-256), used_at — 10 codes à usage unique générés à l'activation TOTP |
| email_tokens | id, user_id, type (`verify`/`reset`/`email_change`/`deletion_cancel`), token_hash, new_email (pour `email_change`), expires_at, used_at |
| username_redirects | old_username, user_id, expires_at |
| banned_identities | id, email_hmac, oauth_subject_hmacs text[], reason_ref, expires_at (1 an) — bloque la réinscription d'un compte banni |
| game_versions | id, slug, name_fr, name_en, position, archived |
| photos | id, user_id, game_version_id, title, description, alt_text, status (`processing`/`failed`/`pending_review`/`published`/`rejected`/`hidden`), r2_key, width, height, bytes, mime, likes_count, comments_count, downloads_count, moderation_score, luma_bl, luma_tr, focal_x, focal_y, quality_tier_notified (0–4, palier déjà notifié, US-71.4), published_at, created_at, search_vector |
| zones | id, slug, name_en, name_fr, aliases text[], status (`active`/`pending`), created_at |
| photo_metadata | photo_id, zone_id (FK zones, nullable), zone_custom (texte libre si zone absente), in_game_time, graphics_settings, character_name, character_class, character_race |
| tags / photo_tags | tags(id, slug, label) ; photo_tags(photo_id, tag_id) |
| likes | user_id, photo_id, created_at, PK(user_id, photo_id) |
| comments | id, photo_id, user_id, body, status (`visible`/`hidden`), edited_at, created_at |
| follows | follower_id, followed_id, PK |
| collections / collection_items | collections(id, user_id, name, is_public) ; items(collection_id, photo_id) |
| contests | id, slug, title_en, title_fr, description_en, description_fr, theme, banner_photo_id, starts_at, ends_at, extended (bool), status (`draft`/`scheduled`/`open`/`judging`/`closed`/`cancelled`), criteria jsonb (game_version_id, zone_ids, required_tag), min_entries (déf. 10), blind_voting (bool), rewards_text, created_by, created_at |
| contest_entries | id, contest_id, photo_id (unique parmi les participations actives), user_id, submitted_at, status (`active`/`withdrawn`/`disqualified`), disqualify_reason, score, final_rank ; unique(contest_id, user_id) where status = 'active' |
| user_badges | id, user_id, type (`contest_champion`/`contest_silver`/`contest_bronze`/`contest_participant`/`ninja_looter` (US-80.2)/`secret_quest` (US-81.4)), contest_id (nullable), quest_id (nullable), visible (bool, défaut vrai : l'utilisateur choisit de l'afficher sur son profil), awarded_at ; unique (user_id, type) pour `ninja_looter`, unique (user_id, quest_id) pour `secret_quest` |
| user_social_links | user_id, platform (`twitch`, `youtube`, `x`, `bluesky`, `instagram`, `tiktok`, `reddit`, `discord`, `website`), handle, updated_at ; PK (user_id, platform) ; supprimés avec le compte (US-82) |
| secret_quests | (v1.x, T-73) id, slug (unique), title_en, title_fr, season, starts_at, ends_at, status (`draft`/`active`/`closed`), badge_code, title_code, created_by, created_at |
| secret_steps | (v1.x, T-73) id, quest_id, ordinal, trigger (`console`/`not_found`/`tooltip`/`search`/`konami`/`upload`/`other`), context_kind (`none`/`photo`/`tag`/`zone`), context_ref (nullable), answer_hmac (HMAC-SHA256 avec `SECRETS_HMAC_KEY`, la réponse en clair n'est jamais stockée), clue_en, clue_fr ; unique (quest_id, ordinal) |
| secret_progress | (v1.x, T-73) user_id, quest_id, current_ordinal, started_at, completed_at (nullable), hall_opt_out (bool) ; PK (user_id, quest_id) ; supprimée avec le compte (purge J+30) |
| notifications | id, user_id, type, payload jsonb, read_at, created_at |
| reports | id, reporter_id, target_type (`photo`/`comment`/`profile`), target_id, reason (`nudity`/`violence`/`hate`/`spam`/`copyright`/`personal_info`/`other`), comment, created_at, unique(reporter_id, target_type, target_id) |
| moderation_decisions | id, target_type, target_id, decision, source (`auto`/`manual`), moderator_id, reason, scores jsonb, created_at |
| bug_reports | id, user_id (nullable), ip_hash, category, body, page_url, user_agent, screenshot_key, fingerprint, duplicate_of, status (`queued`/`sent`/`duplicate`/`spam`/`held`), github_issue_number, created_at |
| site_settings | key, value jsonb, updated_by, updated_at (seuils de qualité, de modération et d'affichage, `moderation.reportsToHide`, hero, editor's pick, flags `features.*`, `legal` : version des Terms en vigueur (version à venir avec date d'effet : v1.x, T-70)) |
| rate_limit_counters | key_hmac (action + compte ou IP, HMAC), window_start, count, PK(key_hmac, window_start) — fenêtres longues (heure, jour) ; purge horaire des fenêtres échues |
| beta_invites | id, email_hmac, token_hash, invited_by, created_at, expires_at (14 jours), used_at — mode bêta sur invitation (US-56.4) |
| waitlist_entries | id, email, locale, created_at — supprimées 3 mois après l'ouverture publique |
| leaderboard_snapshots | period (`week`/`month`/`all`), game_version_id (nullable = toutes), photo_id, rank, score, computed_at ; index (period, game_version_id, rank) — recalculé toutes les 5 min par Cron Trigger, top 50 + rang de chaque photo de la période |
| sanctions | id, user_id, type (`warning`/`suspension`/`ban`), ends_at, reason, moderator_id, created_at, lifted_at, lifted_by |
| appeals | (v1.x, T-71) id, decision_id (unique), user_id, message, status (`open`/`accepted`/`rejected`), resolution, handled_by (≠ auteur de la décision), handled_at, created_at |
| contest_like_signals | (v1.x, T-64c) contest_id, photo_id, user_id, ip_hash (HMAC avec une clé dérivée de `CONTEST_IP_KEY` et de l'id du concours ; préfixe `/64` en IPv6), created_at — rempli seulement pour les likes sur une participation d'un concours ouvert ; purgé 30 jours après `closed` |
| downloads | user_id, photo_id, day, PK(user_id, photo_id, day) — déduplication du compteur |
| audit_log | id, actor_id, action, target_type, target_id, before jsonb, after jsonb, ip_hash, created_at — insertion seule (rôle base sans UPDATE/DELETE) |
| processed_messages | message_id, consumer, processed_at — idempotence des consommateurs de Queue |
| outbox | id, topic, payload jsonb, created_at, published_at — événements écrits dans la même transaction que la donnée métier, relayés vers les Queues (cf. `10-clean-architecture.md` § 4) |

Conventions : UUID v7 pour toutes les clés ; `created_at`/`updated_at` en `timestamptz` UTC ; suppression logique uniquement là où la spec l'exige (`pending_deletion`, `trash/`), sinon suppression physique avec contraintes `ON DELETE` explicites ; index sur toutes les clés étrangères et sur `(status, game_version_id, published_at desc)` pour les grilles.

Compteurs dénormalisés (`likes_count`…) mis à jour en transaction.

**Rôles de base (T-05a)** : le propriétaire `neondb_owner` sert uniquement aux migrations (`scripts/database.mjs`, URL obtenue par l'API Neon, jamais stockée) ; le Worker se connecte par Hyperdrive avec `ls_app`, rôle de connexion créé en SQL (`NOSUPERUSER NOCREATEDB NOCREATEROLE` : un rôle créé par l'API Neon serait membre de `neon_superuser` et hériterait des droits du propriétaire), membre du rôle `app_rw` qui a lecture et écriture sur les tables, sauf `UPDATE`, `DELETE` et `TRUNCATE` sur `audit_log`. Les droits sont posés par migration et s'appliquent aux tables futures (`ALTER DEFAULT PRIVILEGES`). En production, les migrations s'exécutent dans `deploy-production` avant le déploiement du code ; la branche modèle des previews (`preview-template`, sans données, ADR-018) reçoit les mêmes migrations, et chaque preview n'applique que celles de sa PR.

## Sécurité
Voir `08-securite.md` (modèle de menaces, contrôles par couche, en-têtes, upload, sessions, secrets, tests de sécurité). Ce document fait foi.

## Analytics
- Cloudflare Web Analytics : sans cookie, toujours actif.
- PostHog EU, après consentement. Événements : `signup`, `login`, `photo_uploaded`, `photo_published`, `photo_liked`, `comment_posted`, `photo_shared`, `photo_downloaded`, `user_followed`, `collection_created`, `report_submitted`, `bug_reported`.

## PWA, cache et mobile

### Manifest (`/manifest.webmanifest`, généré par @vite-pwa/nuxt)
| Champ | Valeur |
|---|---|
| id / start_url / scope | `/` / `/?source=pwa` / `/` |
| name / short_name | Legendary Shots / Legendary |
| display / display_override | `standalone` / `["window-controls-overlay", "standalone"]` |
| orientation | `any` (paysage utile pour les captures) |
| theme_color / background_color | `#0B0E14` / `#0B0E14` |
| lang / dir / categories | `en` / `ltr` / `["photo", "games", "entertainment"]` |
| icons | 192 et 512 `any` ; 512 `maskable` (emblème dans la zone sûre de 80 %, fond #0B0E14) ; 512 `monochrome` ; issus de `docs/design/Logo.dc.html` |
| screenshots | 2 `narrow` (1080×1920) et 2 `wide` (1920×1080) : home, PDP |
| shortcuts | MVP : Upload (`/upload`), Search (`/search`), Notifications (`/notifications`) ; Leaderboard (`/leaderboard`) ajouté avec US-22 (v1.x) |
| share_target | **v1.x (US-66)** : `action: /share-target`, `method: POST`, `enctype: multipart/form-data`, `params.files: [{ name: "capture", accept: ["image/jpeg","image/png","image/webp"] }]` (Android/Chrome ; non supporté par iOS) |

Balises complémentaires : `apple-touch-icon` 180 px, `mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style=black-translucent`, `viewport-fit=cover`, favicon SVG + ICO 32.

### Service worker (Workbox, mode `injectManifest`, cf. ADR-008)
| Ressource | Stratégie | Cache | Limites |
|---|---|---|---|
| Shell : JS, CSS hachés, polices, icônes, page `/offline` | Precache | `precache-v{build}` | ≤ 3 Mo au total |
| Navigations HTML publiques | NetworkFirst, timeout 3 s, repli cache puis `/offline` | `pages` | 30 entrées, 7 jours |
| Navigations privées (`/settings`, `/admin/*`, `/notifications`, `/upload`) | NetworkOnly | — | — |
| API GET publiques (listes, PDP, classement, recherche) | StaleWhileRevalidate | `api-public` | 100 entrées, 24 h |
| API privées (`/api/me/*`, notifications) et toutes les mutations | NetworkOnly | — | — |
| Images d'affichage (`/img/{id}/400`, `/800`, `/1200`) | CacheFirst, réponses 200 uniquement | `img` | 300 entrées, 30 jours, `purgeOnQuotaError` |
| Grandes variantes (2400) et originaux R2 | NetworkOnly | — | trop lourds |
| Analytics, publicité, Turnstile, OAuth | NetworkOnly | — | — |

- Budget de stockage visé : < 50 Mo par appareil.
- **Déconnexion** : le client envoie `CLEAR_USER_CACHES` au SW, qui vide `pages` et `api-public` (évite d'afficher l'avatar ou des données d'un autre compte sur un appareil partagé).
- **Share target (v1.x)** : le SW intercepte le POST `/share-target` (sans SW actif, le serveur répond 303 vers `/upload`), stocke le fichier dans IndexedDB, redirige vers `/upload?shared=1` ; le formulaire récupère le fichier. Si non connecté : connexion puis reprise.
- **Mises à jour** : `registerType: prompt`. Quand un nouveau SW attend, un toast « A new version is available · Reload » s'affiche ; `skipWaiting` uniquement sur action utilisateur, et jamais pendant un upload en cours. `cleanupOutdatedCaches` à l'activation.
- **Hors ligne** : bandeau « You're offline » (événements `online`/`offline` + échec réseau), boutons Like, Comment, Upload, Follow désactivés avec infobulle ; page `/offline` avec le logo et la liste des pages récemment vues présentes en cache.

### En-têtes HTTP (Worker Nuxt + Cloudflare)
| Ressource | Cache-Control |
|---|---|
| HTML | `no-cache` (personnalisé ; jamais mis en cache par le CDN) |
| `/_nuxt/*` (hachés), polices | `public, max-age=31536000, immutable` |
| `/sw.js` | `no-cache` |
| `/manifest.webmanifest` | `public, max-age=86400` |
| `/img/*`, `/avatar/*` | `public, max-age=2592000, immutable` (cache edge via l'API Cache) ; purge par URL à la suppression ou au masquage ; une nouvelle version d'avatar change d'URL |
| API publiques GET | `public, max-age=60, stale-while-revalidate=300` |
| API privées | `private, no-store` |

### Polices
Auto-hébergées via `@nuxt/fonts` (Cinzel, Cinzel Decorative, Inter), sous-ensembles latin + latin-ext, `font-display: swap`. Aucun appel à Google Fonts depuis le site (performance et RGPD).

### Images responsive
`<WowImage>` génère `srcset` 400w / 800w / 1200w / 2400w via la route `/img` (WebP, ADR-012) et un `sizes` adapté à chaque grille ; `width`/`height` toujours renseignés (pas de CLS) ; `loading="lazy"` sauf l'image LCP (hero, image PDP) en `fetchpriority="high"`.

### Budgets de performance (mobile milieu de gamme, 4G)
LCP < 2,5 s · INP < 200 ms · CLS < 0,1 · JS initial < 170 Ko gzip · page d'accueil < 1,2 Mo transférés au premier chargement. Contrôlés par Lighthouse CI sur chaque PR (seuils : Performance ≥ 85, Accessibility ≥ 95, Best practices ≥ 95, PWA installable).

## Conventions d'API
- REST JSON sous `/api`, routes Nitro fines (`10-clean-architecture.md`) ; noms au pluriel, kebab-case ; pas de versionnement d'URL (client et serveur déployés ensemble), mais aucun champ supprimé sans dépréciation d'une version.
- Entrées et sorties décrites par des schémas Zod partagés (`shared/contracts/`), réutilisés côté client pour les types et la validation de formulaire.
- **Erreurs** : format unique `{ error: { code, message, details?, correlationId } }` ; codes métier stables (`FILE_TOO_LARGE`, `RATE_LIMITED`, `EMAIL_NOT_VERIFIED`…, liste unique dans `shared/contracts/errors.ts`) traduits côté client ; statuts HTTP : 400 validation, 401 non authentifié, 403 interdit, 404 introuvable (aussi pour une ressource privée d'autrui), 409 conflit, 413 trop gros, 422 règle métier, 429 limite (`Retry-After`), 500.
- **Pagination** : par curseur opaque (`?cursor=…&limit=30`, `limit` ≤ 60), réponse `{ items, nextCursor }`.
- **Idempotence** : les mutations sensibles aux doubles clics (like, follow, participation) sont idempotentes par construction (contrainte unique) ; l'upload `complete` accepte un en-tête `Idempotency-Key`.
- **Identifiant de corrélation** : `cf-ray` repris dans chaque log et chaque réponse d'erreur.

### Inventaire des routes (MVP)
Source de la matrice d'autorisation (08, annexe B) : toute route ajoutée ici y reçoit une ligne, et inversement.

| Domaine | Routes |
|---|---|
| Auth | `POST /api/auth/signup`, `POST /api/auth/signin`, `POST /api/auth/signout`, `POST /api/auth/verify-email`, `POST /api/auth/resend-verification`, `POST /api/auth/password/forgot`, `POST /api/auth/password/reset`, `POST /api/auth/email/confirm` (changement d'email), `POST /api/auth/deletion/cancel` (jeton reçu par email), `GET /auth/{google,battlenet}` + callbacks, `GET /api/auth/oauth/pending` (identité en attente), `POST /api/auth/oauth/complete` (pseudo + Terms au premier login), `POST /api/auth/mfa/setup`, `POST /api/auth/mfa/verify`, `POST /api/auth/mfa/challenge` (TOTP ou code de secours après connexion staff), `POST /api/auth/reauth`, `POST /api/waitlist` (mode invitation) |
| Compte | `GET/PATCH /api/me`, `GET /api/me/photos` (« My captures », tous statuts), `GET /api/me/sessions`, `DELETE /api/me/sessions/{id}`, `POST /api/me/sessions/revoke-others`, `POST /api/me/avatar-upload-url`, `POST /api/me/avatar/complete`, `GET /api/me/account` (email et présence d'un mot de passe, pour les réglages ; US-07.2), `POST /api/me/email`, `POST /api/me/password`, `DELETE /api/me/oauth/{provider}`, `POST /api/me/deletion`, `GET /api/usernames/{name}/availability`, `GET/PUT /api/me/social-links` (liste complète, validée par Zod ; GET rend les identifiants bruts aux réglages, même masqués sur le profil ; US-82) |
| Profils | `GET /api/users/{username}` (réseaux sociaux inclus, liens construits par le serveur à partir des gabarits de `shared/domain/social-links.ts`, règles pures partagées client et serveur et testées ; US-82.4–5), `GET /api/users/{username}/photos` |
| Captures | `POST /api/photos/upload-url`, `POST /api/photos/{id}/complete`, `GET /api/photos` (filtres, curseur), `GET /api/photos/{id}`, `GET /api/photos/{id}/related` (US-70), `PATCH /api/photos/{id}`, `DELETE /api/photos/{id}`, `POST /api/photos/{id}/download` |
| Médias | `GET /img/{photoId}/{400,800,1200,2400}`, `GET /img/{photoId}/og.jpg`, `GET /img/{photoId}/{w}?preview=1` (auteur, modérateurs), `GET /avatar/{userId}/{version}/{64,128,256}` |
| Catalogue | `GET /api/game-versions`, `GET /api/zones/suggest?q=`, `GET /api/tags/suggest?q=`, `GET /api/search?q=` |
| Accueil et réglages publics | `GET /api/home` (hero, capture de la semaine, dernières captures, bandeau de quête), `GET /api/settings/public` (seuils de qualité, flags visibles) |
| Social | `PUT/DELETE /api/photos/{id}/like`, `GET/POST /api/photos/{id}/comments`, `PATCH/DELETE /api/comments/{id}` |
| Notifications | `GET /api/notifications`, `GET /api/notifications/unread-count`, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all` |
| Signalements et recours | `POST /api/reports`, `GET /api/me/decisions` (décisions me concernant) ; recours par email au MVP (`POST /api/appeals` : v1.x, T-71) |
| Admin (MFA) | `/api/admin/moderation/*` (file, décisions), `/api/admin/reports/*`, `/api/admin/sanctions/*`, `/api/admin/users` (recherche) et `/api/admin/users/{id}/role`, `/api/admin/game-versions/*`, `/api/admin/zones/*`, `/api/admin/settings`, `/api/admin/invites/*` et `/api/admin/waitlist`, `/api/admin/audit`, `/api/admin/bug-reports/*` |
| Divers | `POST /api/bug-reports` (multipart, capture ≤ 5 Mo facultative), `GET /sitemap.xml` (+ lots `sitemap-{n}.xml`), `GET /robots.txt`, `GET /api/health` |
| Preview uniquement | `/__test/*` (reset de base, boîte mail factice, horloge) — absent des builds de production |
| v1.x | follows (`PUT/DELETE /api/users/{username}/follow`, `GET /api/feed`), collections (`/api/collections/*`), classement (`GET /api/leaderboard`), concours (`/api/contests/*`, `/api/admin/contests/*`), export (`POST /api/me/export`), versions des Terms (`/api/admin/legal`, `POST /api/me/terms/accept`, T-70), recours (`POST /api/appeals`, `/api/admin/appeals/*`, T-71), `POST /share-target`, désinscription du récap (`GET /api/email/unsubscribe?token=`), quêtes secrètes (`POST /api/secrets/{slug}/attempt` : corps `answer`, `context?`, réponse `{ ok, clue?, completed? }` ; `GET /api/secrets/{slug}/hall` ; `GET/POST/PATCH /api/admin/secrets/*`, T-73, T-74), badge cosmétique « Ninja Looter » (US-80.2, T-72) |

## Files d'attente et tâches planifiées
| Queue | Producteur | Consommateur | Retries | DLQ |
|---|---|---|---|---|
| `photo-process` | upload `complete`, avatar `complete` | traitement image (captures et avatars) + modération | 3, backoff 30 s → 5 min | `photo-process-dlq` → capture `failed`, alerte |
| `notifications` | tous modules | création + regroupement, email éventuel | 5 | `notifications-dlq` |
| `emails` | identity, notifications | envoi Resend | 5 | `emails-dlq` |
| `feedback` | bug report | réencodage de la capture jointe (binding Images), création issue GitHub | 5 | `feedback-dlq` |
| `account-purge` | cron | suppression en cascade d'un compte | 5 | `account-purge-dlq`, alerte |

Tous les consommateurs sont **idempotents** (`processed_messages` + opérations conditionnelles) : Cloudflare Queues livre au moins une fois. Un message porte `{ eventId, payload }` : `eventId` est l'identifiant de la ligne d'outbox, stable même si le relais renvoie l'événement ; la garde `onceOnly` (`server/db/idempotency.ts`) enregistre `(consommateur, eventId)` dans la transaction du traitement.

| Cron Trigger | Fréquence | Rôle |
|---|---|---|
| `*/5 * * * *` | 5 min | transitions de concours, recalcul classements (v1.x), alertes anti-triche |
| `0 * * * *` | horaire | relais de l'outbox (événements refusés par une file après le commit, T-05b), battement de la chaîne cron → file, nettoyage des uploads orphelins (> 24 h), tokens expirés, fenêtres échues de `rate_limit_counters` |
| `15 3 * * *` | quotidien | purge de l'outbox publiée (> 7 jours) et de `processed_messages` (> 30 jours), purge des comptes à J+30, notifications > 6 mois, bug reports > 12 mois, décisions de modération, signalements traités, recours traités et sanctions échues > 1 an, `downloads` > 30 jours (le compteur est déjà incrémenté), `username_redirects` expirées, invitations utilisées ou expirées > 30 jours, `processed_messages` > 30 jours, `outbox` publiée > 7 jours, `audit_log` > 2 ans, `banned_identities` expirées, sessions et jetons expirés, `waitlist_entries` 3 mois après l'ouverture, `trash/` (lifecycle R2 30 j en complément), sitemap, entrée en vigueur d'une nouvelle version des Terms (v1.x, T-70) |
| `0 8 * * 1` | hebdomadaire | récap email (v1.x) |

## Configuration et secrets
| Nom | Type | Usage |
|---|---|---|
| `NUXT_APP_SECRET` | secret (≥ 32 car.) | secret racine de Nuxt ; nuxt-auth-utils en dérive le scellement du cookie de session (le cookie ne porte qu'un identifiant aléatoire vérifié en base, ADR-010) ; preview : tiré au hasard à chaque déploiement |
| `DATABASE_URL` / binding `HYPERDRIVE` | secret / binding | Neon |
| `R2` (binding), `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | binding / public / secrets (jeton S3 limité au bucket, lecture-écriture objets) | stockage, URLs présignées |
| `IMAGES` | binding | transformations d'images |
| `CF_API_TOKEN_PURGE`, `CF_ZONE_ID` | secret (permission « Cache Purge » sur la zone uniquement) | purge des `/img/*` d'une capture masquée ou supprimée |
| `PHOTO_PROCESS_QUEUE`, `NOTIFICATIONS_QUEUE`, `EMAILS_QUEUE`, `FEEDBACK_QUEUE`, `ACCOUNT_PURGE_QUEUE` | bindings | Queues |
| `RATE_LIMITER_*` | bindings Workers Rate Limiting | limites courtes (fenêtre de 10 ou 60 s, comptées **par emplacement Cloudflare**, donc approximatives) ; les fenêtres longues et les limites strictes passent par `rate_limit_counters`. T-05c : `RATE_LIMITER_MUTATIONS` (120 mutations `/api` / 60 s / IP, espace 1001 en production, 1002 pour les previews). Mesuré sur une preview : exact au sein d'une requête, mais entre requêtes les compteurs se synchronisent avec retard (1 210 sur 1 500 mutations parallèles acceptées en 26 s) : il coupe les rafales massives, jamais une limite fine |
| `NUXT_OAUTH_GOOGLE_CLIENT_ID/SECRET`, `NUXT_OAUTH_BATTLEDOTNET_CLIENT_ID/SECRET` | secrets | OAuth |
| `TURNSTILE_SECRET_KEY` / `NUXT_PUBLIC_TURNSTILE_SITE_KEY` | secret / public | anti-bot |
| `SIGHTENGINE_API_USER/SECRET` | secrets | modération |
| `RESEND_API_KEY` | secret | emails |
| `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_FEEDBACK_REPO` | secrets | bug reports |
| `IP_HASH_KEY_CURRENT/PREVIOUS` | secrets (rotation 30 j) | HMAC des IP |
| `CONTEST_IP_KEY` | secret (v1.x, T-64c ; changée seulement entre deux concours) | clé dérivée par concours pour `contest_like_signals` |
| `SECRETS_HMAC_KEY` | secret (v1.x, T-73 ; distinct des autres clés, jamais changé pendant une quête active) | HMAC des réponses des quêtes secrètes (`secret_steps.answer_hmac`) |
| `MFA_ENCRYPTION_KEY` | secret | chiffrement des secrets TOTP |
| `NUXT_PUBLIC_SENTRY_DSN` | public (le DSN est servi au navigateur ; un seul DSN pour le Worker et le client, Q25) | suivi d'erreurs serveur et client |
| `NUXT_PUBLIC_CF_BEACON_TOKEN` | public | beacon Cloudflare Web Analytics (ajouté par Nuxt avec nonce) |
| `NUXT_PUBLIC_POSTHOG_KEY`, `NUXT_PUBLIC_SITE_URL` | public | analytics, URLs absolues |
| `NUXT_FAKE_PROVIDERS` | variable de build | `true` uniquement en local et en preview ; refusée au démarrage en production |

**Secrets de la CI (GitHub Actions, jamais dans le Worker)** : `CLOUDFLARE_API_TOKEN` (déploiement Workers, Queues, R2 de preview), `CLOUDFLARE_ACCOUNT_ID`, `NEON_API_KEY` (branches de preview), `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` (jeton de service pour les E2E), `BACKUP_R2_ACCESS_KEY_ID` / `BACKUP_R2_SECRET_ACCESS_KEY` et `BACKUP_AGE_RECIPIENT` (sauvegardes).

Validation au démarrage par un schéma Zod (`server/config.ts`) : variable manquante = échec du déploiement. `.env.example` liste tout, sans valeur réelle.

## Environnements
| Env | Hébergement | Base | Données |
|---|---|---|---|
| local | `pnpm dev` (`nuxt dev`, fournisseurs factices et routes de test ; ni Queues ni R2 : les emails ne partent pas) | PostgreSQL 18 dans WSL (`scripts/local-postgres.sh`) : base `ls_dev`, et `ls_test` pour les tests d'intégration (T-04e) | compte de test et invitation (`pnpm db:seed`) |
| preview | Worker `ls-pr-{n}` par pull request (ADR-013) | branche Neon `pr-{n}` créée par la CI depuis la branche modèle `preview-template`, sans données (ADR-018), via sa propre configuration Hyperdrive (ADR-016) | seed de démo + fixtures E2E |
| production | Worker `main` | branche Neon principale | réelles |

Fournisseurs externes en local et en preview : adaptateurs factices activés par `NUXT_FAKE_PROVIDERS=true` (Sightengine, Resend → boîte mail de test consultable, GitHub, OAuth) ; jamais en production.
- **Previews protégées par Cloudflare Access** (Zero Trust, accès limité à Adrien et au jeton de service de la CI) : elles exposent des routes de test et des comptes de démonstration. Politique « protéger tous les Workers » avec exception (bypass) pour le seul Worker de production, afin que chaque nouveau Worker de preview soit protégé dès sa création. Configuration (T-03d, 21/11/2026) : Workers & Pages → Cloudflare Access, portée **All traffic**, règles « Cloudflare account members » (Allow) et `ci-previews` (Service Auth, jeton de la CI) ; sur `legendary-shots`, Worker Access « Make this Worker public » (Bypass) avec la portée **All traffic** — en « Previews only », le bypass ne couvre que les URL de version et la production reste bloquée.
- **Ressources par preview** (ADR-013), créées par la CI à l'ouverture de la PR et supprimées à sa fermeture : Worker `ls-pr-{n}` sur `workers.dev` ; ses 5 Queues et 5 DLQ suffixées `-pr-{n}` (une Queue n'accepte qu'un seul Worker consommateur) ; branche Neon ; préfixe `pr-{n}/` dans le bucket R2 `ls-preview` (CORS propre aux previews) ; Cron Triggers actifs. Une configuration Hyperdrive par preview (ADR-016 ; 25 au plus par compte, largement suffisant pour un seul développeur), pas d'API Cache (inactive sur `workers.dev`).
- **Bêta fermée** : en production avec `features.inviteOnly`, jamais sur une preview (protégée par Access).
- **Routes de test** (`/__test/*`) : présentes uniquement dans les builds `preview` (exclues à la compilation via une variable de build) ; le démarrage en production échoue si `NUXT_FAKE_PROVIDERS=true` ou si une route `/__test` est enregistrée.

### Intégration Nitro / Workers
Le preset `cloudflare_module` expose `fetch` ; les consommateurs de Queues et les Cron Triggers sont branchés via les hooks Nitro `cloudflare:queue` et `cloudflare:scheduled`. **Validé par T-00f (20/11/2026, nitropack 2.13, Worker distant)** : message traité ; une exception dans le hook déclenche les nouveaux essais (1 + `max_retries`), `msg.retry()` aussi ; cron exécuté chaque minute, le premier environ 6 min après le déploiement (à prévoir dans les DoD des previews). Dans un lot, acquitter chaque message (`msg.ack()`) dès qu'il est traité : une exception renvoie tous les messages non acquittés du lot.

## Navigateurs supportés
Deux dernières versions de Chrome, Edge, Firefox et Safari ; Safari iOS ≥ 16.4 ; Chrome Android récent. Pas d'Internet Explorer ni de Safari < 16. Les fonctionnalités absentes (share target, `beforeinstallprompt`) se dégradent proprement.

## Observabilité
- **Logs** : JSON structurés (`level`, `msg`, `correlationId`, `userId` pseudonymisé, `module`, `durationMs`), jamais d'email, de mot de passe, de jeton ni de contenu de fichier ; Workers Logs, rétention 7 jours ; Logpush vers R2 (30 jours) pour l'audit d'incident.
- **Erreurs** : Sentry (`@sentry/cloudflare`) côté Worker et client, `dataCollection` restrictif (ni utilisateur, ni cookies, ni corps, ni query, ni variables locales ; `sendDefaultPii` n'existe plus en v11), erreurs 4xx attendues non envoyées, échantillonnage des traces 10 %, pas d'envoi des source maps au MVP.
- **Santé** : `GET /api/health` (base, R2, Queue) ; sonde externe toutes les 5 min (UptimeRobot ou Cloudflare Health Checks).
- **Alertes** (email admin) : taux d'erreur 5xx > 2 % sur 5 min, file `photo-process` > 500 messages ou DLQ non vide, disjoncteur bug reports déclenché, budget mensuel d'un fournisseur à 80 %.

## Sauvegarde et reprise
- **Neon** : restauration à un instant donné (fenêtre ≥ 7 jours, plan payant dès l'ouverture publique) ; export logique `pg_dump` hebdomadaire exécuté par un **workflow GitHub Actions planifié** (impossible depuis un Worker), chiffré (age) et déposé dans un bucket R2 distinct via l'API S3, conservé 8 semaines.
- **R2** : pas de versionnement d'objets ; les suppressions passent par le préfixe `trash/` (règle de cycle de vie 30 jours), ce qui permet de restaurer une capture supprimée par erreur.
- **Objectifs** : RPO 24 h (images) / quelques minutes (base) ; RTO 4 h. Procédure de restauration testée une fois par trimestre (`docs/runbooks/restore.md`, à écrire en tâche dédiée).

## Emails transactionnels
Domaine d'envoi `mail.legendaryshots.gg` avec SPF, DKIM et DMARC (`p=quarantine`). Modèles bilingues EN/FR : vérification, reset, changement d'email (ancienne et nouvelle adresse), alerte de verrouillage, suppression programmée et annulation, décision de modération, récap hebdo (v1.x). Liens signés à usage unique, jamais de mot de passe ni de jeton en clair dans les logs.

## SEO
Rendu serveur de toutes les pages publiques ; `<title>` et `description` par page ; Open Graph et Twitter Card (`/img/{id}/og.jpg`, JPEG 1200 px : les robots des réseaux sociaux ne lisent pas tous le WebP) ; URL canonique ; `hreflang` en/fr + `x-default` ; données structurées `ImageObject` (auteur, date, licence = lien vers les Terms) sur la PDP ; `sitemap.xml` (index par lots) ; `robots.txt` ; previews en `noindex`.
