# 06 — Plan de tâches

## Règles d'exécution
1. Prendre **la première tâche non cochée** dont toutes les dépendances sont cochées. Ne jamais anticiper une tâche suivante.
2. **Definition of Ready** (vérifiée avant de coder) : stories et AC référencés lus ; sections d'architecture, de sécurité et de Clean Architecture concernées lues ; questions bloquantes absentes de `09-questions-ouvertes.md` (sinon : appliquer l'option par défaut et le signaler).
3. **TDD** : écrire d'abord les tests listés dans la tâche (identifiants `US-xx.n`), les voir échouer, puis coder.
4. **Une tâche = une branche `feat/T-xx-slug` = une PR**, ≈ 400 lignes de code applicatif au plus (hors tests et migrations). Si c'est plus gros, découper et le noter dans la PR.
5. **Definition of Done** (toutes obligatoires) :
   - tests listés écrits et verts ; couverture et `pnpm test:trace` OK (`11-strategie-de-tests.md`) ;
   - lint, typecheck, dependency-cruiser, gitleaks OK ;
   - checklist sécurité `08-securite.md` § 10 cochée dans la PR ;
   - migrations rétrocompatibles (expand → migrate → contract) et seed mis à jour ;
   - textes en i18n EN et FR ; écrans conformes aux maquettes `docs/design/` en desktop et à 360 px — pour un écran sans maquette (réglages, back-office, cookies, 404/500), composer uniquement avec le design system et joindre à la PR des captures desktop et mobile pour validation ;
   - accessibilité : navigation clavier et axe-core sans violation sérieuse sur les écrans touchés (US-75) ;
   - tout composant ajouté ou modifié dans `app/components/ui` a sa story Storybook à jour, tous ses états compris, et sa section du playbook (ADR-019) ;
   - preview déployée, E2E et Lighthouse verts ;
   - si la tâche ajoute des données personnelles : cascade de suppression (US-09) et rétention mises à jour ;
   - tâche cochée ici, écarts et décisions résumés dans la PR, ADR si nouvelle décision d'architecture.
6. Toute fonctionnalité incomplète en production est masquée par un flag (`site_settings.features.*`).
7. **Action humaine** : certaines tâches demandent une action d'Adrien (comptes, domaines, secrets). Préparer tout le reste, documenter la marche à suivre dans la PR et s'arrêter.
8. **Découpage** (20/11/2026) : une tâche trop grosse est découpée en sous-tâches suffixées (`T-03a`, `T-03b`…) qui gardent le numéro d'origine, pour que les renvois des autres documents restent valables. Chaque sous-tâche vise ≈ 400 lignes de code applicatif ou moins et liste ses dépendances.

Légende des tests : **U** unitaire, **I** intégration (API/base), **E** E2E Playwright.

---

## Phase T-00 — Prototypes (avant toute infrastructure)

Scripts jetables dans `prototypes/` (conservés dans `main` pour mémoire, jamais importés par l'application). Chaque prototype a un critère de réussite et un repli ; le résultat est consigné dans `docs/adr/` et dans la matrice d'architecture (`03-architecture.md`). Pas de code applicatif dans cette phase.

- [x] **T-00a Mémoire Worker et 8K** : décoder une capture 8K (7680×4320) dans un Worker n'est pas permis (ADR-011) ; mesurer la mémoire du chemin binding Images avec une image 33,2 Mpx. Réussite : aucune erreur mémoire sur 20 Mo. Repli : limite sous 20 Mpx côté serveur et conversion navigateur obligatoire au-delà.
- [x] **T-00b Binding Images 33,2 Mpx** : confirmer les limites exactes du binding Images (dimension, taille d'entrée, nombre de transformations facturées). Réussite : les 4 variantes et la vignette 64 px sont produites pour un JPEG 8K. Repli : réduire les largeurs de variantes ou passer à deux étapes.
- [x] **T-00c Traitement parallèle** : traiter trois PNG 5120×2160 en parallèle, mesurer le temps total et les erreurs. Réussite : moins de 30 s par capture et aucune erreur. Repli : file séquentielle par capture.
- [x] **T-00d Hachage de mot de passe** : mesurer Argon2id et scrypt (`@noble/hashes`) sur Workers, temps de calcul et mémoire (Q5). Réussite : moins de 500 ms par hachage. Repli : scrypt avec paramètres documentés.
- [x] **T-00e Latence Worker vers Neon** : mesurer la latence d'une requête simple via Hyperdrive et Smart Placement, depuis Paris. Réussite : médiane sous 50 ms. Repli : placer le Worker dans la région de la base, ou accepter une latence plus haute documentée.
- [x] **T-00f Files et crons Nitro** : valider les hooks `cloudflare:queue` et `cloudflare:scheduled` sur un Worker minimal (T-03 en reprend le résultat). Réussite : un message et un cron traités. Repli : consommateur Queue en Worker séparé.
- [x] **T-00g Preview par PR** : créer et supprimer un Worker de preview avec sa Queue, sa branche Neon et son préfixe R2. Réussite : création en moins de 5 min, suppression complète. Repli : preview partielle (Worker sans Queue) documentée.
- [x] **T-00h Comparaison d'hébergement** : comparer l'option A (tout Cloudflare) et l'option B (Vercel pour l'application, stockage des images ailleurs) avec les résultats T-00a à T-00g et le chiffrage aux prix actuels. Pondérations validées le 18/11/2026 : coût 25 %, simplicité 20 %, performance 15 %, sécurité et exploitation 15 %, portabilité 15 %, previews 10 %. Réussite : décision consignée en ADR. AWS écarté le 18/11/2026 (configuration des droits et permissions jugée trop complexe).

**Dépendances** : T-02 et T-03 dépendent de T-00h.

## Phase 0 — Fondations (squelette déployé de bout en bout)

- [x] **T-01a Squelette Nuxt et qualité de code**
  Nuxt 3+ TypeScript strict, pnpm, arborescence de `10-clean-architecture.md` (`shared/`, `server/modules`, `server/platform`, `app/features`, `app/components/ui`…) avec un fichier d'exemple par dossier, ESLint (`vue/no-v-html`, `no-explicit-any`), Prettier, commitlint (Conventional Commits), gitleaks en pre-commit, `.env.example` ; `prototypes/` exclu d'ESLint, du `tsconfig`, de Vitest et de dependency-cruiser.
  Tests : `pnpm lint` et `pnpm typecheck` verts sur le squelette.

- [x] **T-01b Outillage de test** (dép. T-01a)
  Vitest (projets unit / component / integration, seuils de couverture de `11-strategie-de-tests.md` § 2), Playwright (projets desktop, iPhone 14, Pixel 7), script `pnpm test:trace` (chaque AC [MVP] référencé dans un test), script `pnpm check`.
  Tests : un test d'exemple par projet ; `test:trace` échoue sur un AC [MVP] sans test, puis passe une fois l'exemple retiré du périmètre.

- [x] **T-01c Contrôle d'architecture** (dép. T-01a)
  dependency-cruiser avec les règles de `10-clean-architecture.md` § 7, `pnpm arch`.
  Tests : U (le contrôle échoue sur un import interdit d'exemple, puis l'exemple est retiré).

- [x] **T-02a Socle serveur** (dép. T-01b, T-01c)
  `server/platform` : config validée par Zod au démarrage, logger JSON sans données personnelles, type `Result`, erreurs métier → HTTP au format commun, identifiant de corrélation (`cf-ray`), container de composition, ports `Clock` et `IdGenerator` (UUID v7), `GET /api/health`.
  Tests : U (mapping des erreurs, config manquante = échec), I (format d'erreur, health).

- [x] **T-02b Sécurité HTTP** (dép. T-02a)
  nuxt-security : en-têtes, CSP à nonce, vérification d'origine des mutations. Sentry déplacé en T-03a (20/11/2026) : son intégration Workers ne se vérifie qu'avec le compte et un déploiement réel.
  Tests : I (en-têtes présents, CSP avec nonce, mutation cross-origin refusée).

- [x] **T-03a Déploiement de production** (dép. T-02b) — **action humaine** : jeton Cloudflare de la CI dans les secrets GitHub. Découpée le 20/11/2026 en T-03a, T-03e et T-03f. Le domaine (Q3) n'est pas requis : `*.workers.dev` suffit (domaine en T-58).
  `wrangler.toml` de production (Worker `legendary-shots`, bindings R2 privé, Hyperdrive sans cache (ADR-016), Images, variables), build Nitro `cloudflare_module`, `/api/health` qui vérifie la base et R2 (503 si un contrôle échoue), bucket de production et sa politique CORS, démarrage refusé en production avec `NUXT_FAKE_PROVIDERS=true`, workflow `deploy-production` depuis `main` (secrets publiés avec la version, `--secrets-file`, T-00g) qui échoue si l'artefact contient une route `/__test`.
  DoD : `/api/health` de production OK (base et R2) ; l'artefact de production ne contient aucune route `/__test`.

- [x] **T-03e Queues et crons de production** (dép. T-03a)
  Queues et DLQ de `03-architecture.md` § Files, Cron Triggers du MVP (horaire et quotidien ; `*/5` et hebdomadaire avec leurs tâches v1.x), aiguillage des hooks Nitro `cloudflare:queue` et `cloudflare:scheduled` vers les consommateurs par nom de file (acquittement message par message, T-00f), consommateur et cron de test.
  DoD : un message et un cron de test traités en production.

- [x] **T-03f Sentry et Web Analytics** (dép. T-03a) — **action humaine** : compte et projet Sentry (DSN), jeton du beacon Web Analytics.
  Sentry serveur (intégration Workers) et client (`dataCollection` restrictif, ex-`sendDefaultPii: false` ; rapport des violations CSP), beacon Web Analytics ajouté par Nuxt avec nonce (injection automatique désactivée dans le tableau de bord).
  DoD : une erreur de test reçue dans Sentry, sans donnée personnelle ; le beacon se charge sans violation CSP.

- [x] **T-03b Création des previews** (dép. T-03e) — **action humaine** : secret `NEON_API_KEY` et droits Queues, Hyperdrive et R2 du jeton de la CI.
  Workflow `preview-deploy` repris de `prototypes/t00g-preview` (ADR-013, ADR-016) : Worker `ls-pr-{n}`, Queues et DLQ suffixées, branche Neon `pr-{n}`, configuration Hyperdrive dédiée sans cache, préfixe `pr-{n}/` du bucket `ls-preview` (CORS des previews), secrets publiés avec la version, `noindex`, commentaire de la PR avec l'URL.
  DoD : la preview d'une PR répond sur `/api/health` ; un message de Queue est traité sur la preview ; deux PR en parallèle ne partagent ni Queue ni base ; un PUT navigateur vers une URL présignée du bucket de preview passe le CORS.

- [x] **T-03c Suppression des previews** (dép. T-03b)
  Workflow `preview-cleanup` à la fermeture de la PR (consommateurs retirés avant le Worker, T-00g), balayage hebdomadaire des ressources orphelines.
  DoD : la fermeture d'une PR supprime toutes ses ressources, vérifié par l'API.

- [x] **T-03d Protection des previews et périmètre** (dép. T-03b) — **action humaine** : activer Zero Trust.
  Cloudflare Access « tous les Workers » avec bypass du seul Worker de production, jeton de service pour la CI. WAF, règle de limitation et Bot Fight Mode (`08-securite.md` § 2) exigent une zone : reportés au branchement du domaine en T-58 (Q24).
  DoD : une preview sans jeton Access est refusée ; la CI y accède avec le jeton de service ; la production reste publique.

- [x] **T-04a CI : contrôles de PR** (dép. T-03b)
  Workflow `ci` (`11-strategie-de-tests.md` § 7) : lint, typecheck, `arch`, unitaires et couverture, `test:trace`, artefact de production sans route de test, intégration (Postgres de CI, Q15), gitleaks, Semgrep CE (à la place de CodeQL, Q26), `pnpm audit` ; actions épinglées par SHA ; Dependabot. Pas de protection de `main` (Q26). L'étape de CI des migrations arrive avec leur runner (T-05a).
  Tests : une PR de démonstration échoue sur chaque garde.

- [x] **T-04b CI : preview, E2E et production** (dép. T-04a, T-03d)
  Playwright smoke sur la preview (jeton Access), Lighthouse CI, smoke de production après déploiement et retour arrière.
  Tests : la CI elle-même.

- [x] **T-05a Base de données : socle** (dép. T-03a)
  Drizzle, conventions (UUID v7, `timestamptz`, `created_at`/`updated_at`, index), runner de migrations, tables transverses `outbox`, `processed_messages`, `site_settings`, `audit_log` (rôle base sans UPDATE/DELETE), `rate_limit_counters`, `donations` (flag désactivé), seed de base, transaction de test annulée.
  Tests : I (migration sur base vierge, rôle d'audit sans UPDATE/DELETE). Étape `ci` des migrations (`11-strategie-de-tests.md` § 7 : base vierge et copie du schéma de production).

- [x] **T-05b Unité de travail et outbox** (dép. T-05a)
  `UnitOfWork`, relais outbox → Queues, garde d'idempotence `processed_messages` pour les consommateurs.
  Tests : I (relais outbox, double livraison ignorée), contrat `UnitOfWork`.

- [x] **T-05c Limitation de débit** (dép. T-05a)
  Port `RateLimiter` : bindings Workers Rate Limiting déclarés dans `wrangler.toml` (déplacés de T-03e, 20/11/2026) et leur adaptateur (fenêtres courtes) et compteurs en base (fenêtres longues, `08-securite.md` § 8), purge horaire des fenêtres échues.
  Tests : I (compteur exact sur une fenêtre d'une heure), contrat `RateLimiter`.

- [x] **T-06a Design system : fondations** (dép. T-01a)
  CSS natif selon ADR-014 : `tokens.css` (tokens de `07-design.md`), `base.css`, polices auto-hébergées via `@nuxt/fonts`, Stylelint (valeurs en dur interdites hors tokens) ; composants Button, Input, Card, EmptyState, LogoMark. Storybook (ADR-019) : `@nuxtjs/storybook`, addon a11y, page « Fondations » (tokens), une story par composant, build en CI, publication sous `/storybook/` en production (publique, `noindex`) et sur les previews ; **playbook** en pages MDX (introduction et principes, fondations, accessibilité, rédaction, contribuer) et section d'usage de chaque composant.
  Tests : composants (rendu, axe), Stylelint qui échoue sur une couleur en dur d'exemple, build Storybook en CI, `/storybook/` servi en production avec `noindex`.

- [x] **T-06b Design system : superpositions** (dép. T-06a)
  Modal, BottomSheet, Toast, ActionIcon (gestion du focus, Échap, mouvement réduit), avec leurs stories et leur section du playbook (ADR-019).
  Tests : composants (clavier, focus piégé et rendu, axe).

- [x] **T-06c Design system : identité WoW** (dép. T-06a)
  `shared/domain/quality.ts` (`qualityFromLikes(likes, thresholds)`, seuils en paramètre), QualityBadge, ItemTooltip, QuestMarker, ImageScrim, WowImage (prop `src`, sans route `/img`), avec leurs stories et leur section du playbook (ADR-019 : un badge par palier de qualité, scrim sur fonds clair et sombre).
  Tests : U (qualité), composants (contraste d'ImageScrim avec fixtures blanche et noire, axe).

- [ ] **T-07a Mise en page** (dép. T-06b)
  Layout, header partagé (une ligne ≥ 1180 px, barre d'onglets < 768 px, entrées pilotées par les flags : `07-design.md` § Header), footer, safe areas, lien d'évitement, focus visible, mouvement réduit.
  Stories : US-67 (structure), US-75.1, US-75.4. Tests : E (US-67.1, US-67.5–6, US-75.1).

- [ ] **T-07b Bilingue** (dép. T-07a)
  @nuxtjs/i18n (`/` en, `/fr/` fr), détection, sélecteur, contrôle de complétude des clés.
  Stories : US-62.1–3. Tests : U (complétude), E (US-62.1–3).

- [ ] **T-07c Client API et pages d'erreur** (dép. T-07a, T-02a)
  Client API typé `app/services/api` et gestion d'erreur commune, pages 404/500 avec identifiant de corrélation.
  Stories : US-69. Tests : E (US-69.1–2).

- [ ] **T-08 Réglages du site et flags** (dép. T-05a)
  Module `settings` : lecture typée de `site_settings` (seuils de qualité, de modération, d'affichage, hero, editor's pick, flags), cache 60 s, valeurs par défaut de lancement (seuils 3/15/50/150, `moderation.reportsToHide` = 3, `features.inviteOnly` = true jusqu'à l'ouverture), exposition publique en lecture des valeurs non sensibles (`GET /api/settings/public`).
  Stories : US-56 (lecture), US-71.5. Tests : U (validation des réglages US-56.2), I.

- [ ] **T-09a PWA : manifest et service worker** (dép. T-07b)
  @vite-pwa/nuxt `injectManifest` (ADR-008), manifest et icônes depuis `Logo.dc.html` (raccourcis MVP Upload, Search, Notifications ; pas de `share_target` avant T-66), stratégies de `03-architecture.md` § PWA (sans `/img`, ajouté en T-25b), page `/offline`.
  Stories : US-63.1, US-64.2–3. Tests : E (Chromium avec service worker ; installabilité vérifiée par ce test E2E, Lighthouse ne la mesurant plus, Q27).

- [ ] **T-09b PWA : hors ligne, mise à jour, installation** (dép. T-09a)
  Bandeau hors ligne et actions désactivées, toast de mise à jour (`skipWaiting` à la demande), invitation discrète à l'installation.
  Stories : US-63.2–5, US-65. Tests : E.

- [ ] **T-10a Consentement et analytics** (dép. T-07b)
  Panneau cookies conforme à `docs/legal/cookies.md`, chargement conditionnel de PostHog EU, Cloudflare Web Analytics.
  Stories : US-61, US-72 (mécanique). Tests : E (aucun appel PostHog ni cookie avant consentement, retrait).

- [ ] **T-10b Pages légales** (dép. T-07b)
  Pages `/legal`, `/terms`, `/privacy`, `/cookies` depuis `docs/legal/*.md`, date de mise à jour, repli anglais.
  Stories : US-74.1. Tests : E.

## Phase 1 — Identité

- [ ] **T-11a Identité : domaine et comptes** (dép. T-05b, T-08)
  Module `identity` (domain, application, infrastructure) : tables `users`, `sessions`, `email_tokens` ; règles de pseudo et de mot de passe ; hachage Argon2id `@noble/hashes` au format PHC (ADR-015) ; vérification HIBP ; port `Mailer` (Resend + fake).
  Tests : U (règles, hachage et vérification), I (contrat `Mailer`).

- [ ] **T-11b Inscription et vérification d'email : API** (dép. T-11a, T-05c, T-10b)
  `POST /api/auth/signup`, `verify-email`, `resend-verification` : Turnstile, âge 15 ans et Terms (version acceptée enregistrée), limites de débit, politique « email vérifié requis ».
  Stories : US-01 (API), US-08. Tests : U, I (US-01.1–7, US-08.1–2).

- [ ] **T-11c Inscription : écrans** (dép. T-11b, T-07c)
  Pages d'inscription et de vérification conformes à `SignIn.dc.html`.
  Stories : US-01 (parcours). Tests : E (US-01).

- [ ] **T-11d Mode bêta sur invitation** (dép. T-11b)
  Tables `beta_invites`, `waitlist_entries`, inscription refusée sans invitation, liste d'attente (`POST /api/waitlist`).
  Stories : US-56.4. Tests : I, E.

- [ ] **T-12a Sessions : API** (dép. T-11b)
  Sessions en base vérifiées à chaque requête via Hyperdrive sans cache (ADR-010, ADR-016), rotation d'identifiant, `signin` / `signout`, verrouillage progressif, `requireContext`.
  Stories : US-03.1–5. Tests : U, I.

- [ ] **T-12b Sessions : écrans et appareils** (dép. T-12a, T-11c)
  Page de connexion, redirection sûre, liste et révocation des sessions (`/api/me/sessions*`), vidage des caches du service worker à la déconnexion.
  Stories : US-03.6, US-64.4. Tests : I, E.

- [ ] **T-13 Mot de passe oublié** (dép. T-12a)
  Stories : US-04. Tests : U, I, E.

- [ ] **T-14 OAuth Google** (dép. T-12b) — **action humaine** : client OAuth Google.
  State + PKCE, règles de liaison, bouton conforme à la charte Google.
  Stories : US-02.1–5. Tests : U, I (fournisseur factice), E.

- [ ] **T-15 OAuth Battle.net** (dép. T-14) — **action humaine** : client Battle.net.
  Hôte global `oauth.battle.net`, `state` sans PKCE, absence d'email, logo officiel (Q7).
  Stories : US-02.6. Tests : I, E.

- [ ] **T-16 Pseudo et profil public** (dép. T-12a, T-07c)
  Pseudos réservés, changement limité, redirections, page `/u/{pseudo}` (état vide pour les captures).
  Stories : US-05. Tests : U, I, E.

- [ ] **T-17a Réglages du compte : profil et mot de passe** (dép. T-16)
  `/settings` : bio, langue, mot de passe (réauthentification).
  Stories : US-07.1, US-07.3. Tests : U, I, E.

- [ ] **T-17b Réglages du compte : email et comptes liés** (dép. T-17a, T-14)
  Changement d'email avec confirmation (ancienne et nouvelle adresse), comptes liés (refus si plus aucun moyen de connexion).
  Stories : US-07.2, US-07.4. Tests : U, I, E.

- [ ] **T-18a Autorisation déclarative** (dép. T-12a)
  Politiques d'autorisation déclarées par use case (refus par défaut), harnais de **matrice d'autorisation** généré depuis l'inventaire des routes (`08-securite.md` annexe B).
  Stories : US-55 (règles). Tests : U, I (matrice).

- [ ] **T-18b Double authentification du staff** (dép. T-18a)
  TOTP obligatoire après tout mode de connexion, 10 codes de secours, `sessions.mfa_verified_at` et `reauth_at`, commandes `pnpm admin:promote` (premier admin) et `pnpm admin:reset-mfa`.
  Stories : US-55. Tests : U, I, E. **Action humaine** : exécuter `admin:promote` en production après le premier déploiement.

- [ ] **T-18c Rôles, audit et squelette d'admin** (dép. T-18b)
  Promotion et rétrogradation, écriture de l'`audit_log`, squelette `/admin` (accès MFA).
  Stories : US-55, US-58.1. Tests : I, E.

## Phase 2 — Catalogue et publication

- [ ] **T-20a Catalogue : versions du jeu et tags** (dép. T-05a)
  Module `catalog` : versions du jeu (EN/FR, ordre, archivage), tags (normalisation, suggestion), `GET /api/game-versions`, `GET /api/tags/suggest`.
  Stories : US-11.2 (API). Tests : U (normalisation), I.

- [ ] **T-20b Catalogue : dictionnaire des zones** (dép. T-20a)
  Import `docs/seed/zones.csv`, alias, suggestion EN/FR avec `pg_trgm` et `unaccent`, `GET /api/zones/suggest`.
  Stories : US-57.2, US-11.1 (API), US-62.4. Tests : I (suggestion « Hurl », « Stormw », « SW »).

- [ ] **T-21 Demande d'upload** (dép. T-18a, T-20a, T-05c)
  Module `media` : `requestUploadUrl` (politiques, quotas, URL présignée du bucket privé signée sur taille et type), `completeUpload` (idempotent, contrôle `R2.head`), nettoyage des orphelins (cron horaire).
  Stories : US-10.1–2, US-10.5–7. Tests : U, I, contrat `ObjectStorage`, E (PUT navigateur réel sur la preview : CORS et CSP).

- [ ] **T-22a Suppression des métadonnées** (dép. T-01b)
  Traitement d'octets pur dans `media/domain` (ADR-011) : JPEG (APP1, APP3–APP13, APP15, COM retirés ; APP0, ICC, APP14 conservés), PNG (`eXIf`, `tEXt`, `iTXt`, `zTXt`, `tIME`), WebP (`EXIF`, `XMP ` et drapeaux `VP8X`), refus d'une orientation ≠ 1, calcul de la taille finale.
  Stories : US-14.1 (suppression des métadonnées). Tests : U (corpus `tests/fixtures/images` et `malicious` : pixels identiques, aucune métadonnée, ICC conservé ; JPEG Display P3 et APP14, PNG `iCCP`, WebP `VP8X` avec EXIF).

- [ ] **T-22b Traitement des captures** (dép. T-21, T-22a)
  Consommateur `photo-process` (ADR-011, ADR-012, résultats T-00a–c) : octets magiques, `IMAGES.info()`, original nettoyé écrit en deux passes (`FixedLengthStream`), variantes écrites une fois (PNG 64 temporaire, JPEG 1200, WebP 400/800/1200/2400), luminance, idempotence, retries et DLQ.
  Stories : US-14.1–3, US-14.5–6, US-10.3–4, US-10.8. Tests : I (double livraison), charge (US-14.5).

- [ ] **T-23a Notifications : module** (dép. T-12a, T-05b)
  Module `notifications` : création via événements, regroupement des likes, préférences par type, purge à 6 mois.
  Stories : US-35.1–2, US-35.4–5, US-07.5. Tests : U (regroupement, préférences), I.

- [ ] **T-23b Notifications : cloche et Quest log** (dép. T-23a, T-07c)
  Compteur de non-lus, page « Quest log », lecture unitaire et globale.
  Stories : US-35.3. Tests : E.

- [ ] **T-24 Modération automatique** (dép. T-22b, T-23a, T-08)
  Port `ModerationProvider` (Sightengine + fake), seuils depuis `site_settings`, retries, historique `moderation_decisions`, notification de l'auteur.
  Stories : US-50. Tests : U (seuils), I (pannes), E (fichier NSFW de fixture refusé).

- [ ] **T-25a Service des images** (dép. T-22b)
  Routes `/img/{id}/{w}` et `/img/{id}/og.jpg` (variantes lues dans R2 sans transformation, largeurs fixes, captures publiées uniquement, API Cache), aperçu privé `?preview=1` pour l'auteur et les modérateurs, masquage = variantes dans `trash/` + purge par URL.
  Stories : US-14.4, US-68.3. Tests : I (largeur invalide = 404, capture non publiée = 404 publiquement et 200 pour l'auteur).

- [ ] **T-25b Images dans l'interface et « My captures »** (dép. T-25a, T-06c, T-09a)
  `WowImage` branché sur `/img` (`srcset`, `sizes`, dimensions, texte alternatif), règles du service worker pour `/img`, page « My captures » avec statuts.
  Stories : US-64.1, US-64.5–6, US-75.3. Tests : E.

- [ ] **T-26a Formulaire d'upload** (dép. T-21, T-24, T-25b, T-20b)
  Page `/upload` conforme à la maquette : sélection, validation client (règles `shared/domain`), progression et reprise, champs, zone et tags en autocomplétion, légende, texte alternatif, case de consentement (JPEG, PNG, WebP).
  Stories : US-10 (parcours), US-11. Tests : composants, E (JPEG de bout en bout ; aucune violation CSP).

- [ ] **T-26b Conversion dans le navigateur** (dép. T-26a)
  TGA → PNG ; au-delà de 20 Mo : WebP sans perte puis JPEG 95 4:4:4 avec avertissement ; Web Worker et encodeurs WebAssembly libwebp et MozJPEG chargés à la demande ; échec mémoire géré.
  Stories : US-10.9–10. Tests : U (choix de la chaîne), E (TGA de bout en bout ; PNG 5K2K de 25 Mo → WebP sans perte ; TGA 8K → JPEG 95 avec avertissement).

- [ ] **T-26c Point focal et aperçu** (dép. T-26a)
  Point focal, aperçu en direct du recadrage.
  Stories : US-13. Tests : composants, E.

- [ ] **T-27 Modifier et supprimer une capture** (dép. T-26a)
  Stories : US-12. Tests : U (propriété), I (IDOR), E.

- [ ] **T-28 Avatar** (dép. T-17a, T-24, T-25a)
  Upload présigné dédié (2 Mo), recadrage carré, message `avatar-process`, variantes WebP 64/128/256 écrites une fois, modération automatique, ancien avatar conservé jusqu'à validation, route `/avatar/{userId}/{version}/{size}`.
  Stories : US-07.6. Tests : U, I, E.

## Phase 3 — Découverte

- [ ] **T-30 Galerie et PLP** (dép. T-25b, T-08)
  Module `gallery` : requêtes de grille par version, filtres, tris, pagination par curseur, état vide « Be the first », infobulle de qualité « ? ».
  Stories : US-20, US-70.5, US-71.1. Tests : U, I (pagination stable), E.

- [ ] **T-31a Page photo** (dép. T-30)
  PDP, infobulle façon objet, Open Graph, `ImageObject`.
  Stories : US-25.1, US-71.2. Tests : I, E.

- [ ] **T-31b Navigation entre captures** (dép. T-31a)
  Précédent/suivant, swipe, « More from » avec replis.
  Stories : US-67.2–3, US-70.1–2. Tests : E.

- [ ] **T-32 Page d'accueil** (dép. T-30, T-08)
  Hero administrable avec voile, « Capture of the week » et ses replis, bandeau de quête (masqué tant que `features.contests` est désactivé).
  Stories : US-24, US-70.4. Tests : U (replis), E.

- [ ] **T-33a Recherche : moteur** (dép. T-30, T-20b)
  ADR-007 : `search_vector`, résolution des zones, tolérance aux fautes, score, `GET /api/search`.
  Stories : US-21 (API). Tests : U, I (jeu de données de recherche).

- [ ] **T-33b Recherche : écran** (dép. T-33a)
  Autocomplétion, filtres, page sans résultat.
  Stories : US-21 (parcours). Tests : E.

- [ ] **T-34 Téléchargement HD** (dép. T-31a)
  URL présignée 5 min, déduplication du compteur, limites, reprise après connexion ; Q18.
  Stories : US-23. Tests : U, I, E.

- [ ] **T-35 SEO** (dép. T-31a)
  Métadonnées, canonique, `hreflang`, sitemap (cron quotidien), robots, `noindex` des previews, 404/410 des contenus retirés.
  Stories : US-25.2–4. Tests : I, E.

## Phase 4 — Communauté et qualité

- [ ] **T-40 Likes et qualité** (dép. T-31a, T-23a)
  Like idempotent, interdiction de l'auto-like, limites, recalcul de qualité, notification de palier (une fois par palier).
  Stories : US-30, US-71.4. Tests : U, I (concurrence), E.

- [ ] **T-41 Commentaires** (dép. T-31a, T-23a)
  Rendu texte, filtre d'insultes (Q8), édition 15 min, suppression, limites.
  Stories : US-31. Tests : U, I, E (dont XSS).

- [ ] **T-42 Partage** (dép. T-31a)
  `navigator.share`, menu de repli, événement analytics.
  Stories : US-32, US-72.1. Tests : E.

- [ ] **T-43 Pédagogie de la qualité** (dép. T-40)
  Survol/tap des badges, notification de première capture, progression sur le profil, page `/help/quality`.
  Stories : US-71.2–3. Tests : U, E.

- [ ] **T-44 États vides complets** (dép. T-40, T-32)
  Compteurs masqués sous 10, badge « New », tous les replis restants ; test E2E sur base vierge.
  Stories : US-70. Tests : U, E.

## Phase 5 — Modération, administration, conformité

- [ ] **T-50 Signalements** (dép. T-41)
  Motifs, signalement de profil, masquage automatique limité aux signalements de comptes éligibles (vérifiés depuis plus de 7 jours, non sanctionnés).
  Stories : US-51. Tests : U, I, E.

- [ ] **T-51 File de modération et décisions** (dép. T-50, T-18c)
  File `/admin/moderation`, décisions motivées (Digital Services Act : motif, règle, automatisation), notification de l'auteur avec la **voie de recours par email** (recours traités à la main au MVP, 20/11/2026), annulation d'une décision par un modérateur (capture republiée, auteur notifié). Recours dans l'application : T-71 (v1.x).
  Stories : US-52.1–3, US-52.6. Tests : U, I, E.

- [ ] **T-52 Sanctions** (dép. T-51)
  Avertissement, suspension, bannissement (admin + réauthentification), effets sur toutes les politiques, `banned_identities` contre la réinscription.
  Stories : US-53. Tests : U, I (matrice avec rôle suspendu), E.

- [ ] **T-53a Back-office : catalogue** (dép. T-18c, T-20b)
  Écrans `/admin` des versions du jeu et de la file des zones à valider (fusion).
  Stories : US-54, US-57.1. Tests : I, E.

- [ ] **T-53b Back-office : réglages et audit** (dép. T-18c, T-08)
  Réglages du site et flags (réauthentification), consultation du journal d'audit.
  Stories : US-56, US-58.2. Tests : U, I, E.

- [ ] **T-53c Back-office : invitations** (dép. T-18c, T-11d)
  Invitations nominatives et liste d'attente.
  Stories : US-56.4 (admin). Tests : I, E.

- [ ] **T-54a Signalement de bug : réception** (dép. T-12a, T-05c)
  Module `feedback` : formulaire et `POST /api/bug-reports`, Turnstile, honeypot, délai de 3 s, limites de débit, contenu (longueur, liens, insultes), capture jointe, empreinte des doublons, disjoncteur.
  Stories : US-60 (réception). Tests : U, I, E.

- [ ] **T-54b Signalement de bug : GitHub et admin** (dép. T-54a, T-18c) — **action humaine** : dépôt privé et GitHub App (Q10).
  Consommateur `feedback` : réencodage de la capture, issue GitHub échappée (Markdown neutralisé, mentions désactivées, aucune donnée personnelle), compteur « +1 » des doublons ; écran admin « marquer spam ».
  Stories : US-60 (envoi, admin). Tests : U (échappement), I (fake GitHub), E.

- [ ] **T-55a Suppression de compte : demande** (dép. T-17b)
  `pending_deletion`, annulation par lien, écran et email de confirmation.
  Stories : US-09.1, US-09.3–4. Tests : U, I, E.

- [ ] **T-55b Suppression de compte : purge** (dép. T-55a, T-27, T-28, T-41, T-40, T-52)
  Purge à J+30 (Queue `account-purge`) sur toutes les tables, R2 (captures et avatar), PostHog ; pseudonymisation dans l'audit et la modération ; empreinte `banned_identities` si banni ; test de cascade exhaustif (échoue si une table liée à `users` n'est pas couverte).
  Stories : US-09.2, US-09.5. Tests : U, I (cascade).

- [ ] **T-56 Exploitation** (dép. T-04b)
  Runbooks `docs/runbooks/` : restauration (et test réel de restauration Neon + R2 `trash/`), incident (rotation des secrets, mode lecture seule), modération (contenus illicites, PHAROS, traitement des recours reçus par email) ; alertes de `03-architecture.md` § Observabilité ; workflow GitHub Actions planifié `pg_dump` chiffré vers R2.
  Tests : exercice de restauration documenté dans la PR.

- [ ] **T-57 Durcissement et revue de sécurité** (dép. T-50 à T-55b)
  Matrice d'autorisation complète verte, OWASP ZAP sans alerte « High », checklist ASVS niveau 2, CSP sans violation, budgets de performance, audit d'accessibilité complet, vérification de la rétention.
  Stories : US-68, US-75. Tests : I, E, ZAP, Lighthouse.

- [ ] **T-58 Recette MVP et bêta fermée** (dép. T-57) — **action humaine** : validation de Q6, Q7, Q8, Q11, Q13 ; registre des traitements et accords de sous-traitance signés (Q11).
  Exécution de tous les parcours de `11-strategie-de-tests.md` § 5 sur la preview de release, puis **bêta en production** avec `features.inviteOnly` (20 à 30 photographes, ≥ 200 captures ; jamais sur une preview, protégée par Access), correction des retours. **Action humaine avant l'ouverture** : domaine (Q3) branché sur le Worker de production (API Cache de `/img` active), WAF, règle de limitation et Bot Fight Mode de la zone (`08-securite.md` § 2, Q24), domaine d'envoi Resend (SPF, DKIM, DMARC), Resend Pro et Neon Launch actifs (`05-finops.md`), décision sur le plan Cloudflare Pro.

**Jalon : ouverture publique (désactivation du mode invitation).**

## Phase 6 — v1.x (chaque tâche livrée derrière son flag)

- [ ] **T-60 Abonnements et fil** (dép. T-58) — US-33. Tests : U, I, E.
- [ ] **T-61 Collections** (dép. T-58) — US-34. Tests : U, I, E.
- [ ] **T-62 Récap email hebdomadaire** (dép. T-58) — US-36. Tests : U, I.
- [ ] **T-63 Classement** (dép. T-58) — `leaderboard_snapshots`, cron 5 min, « Your best ». US-22, US-70.3. Tests : U, I, E.
- [ ] **T-64a Concours : modèle et cycle de vie** (dép. T-63) — machine à états, cron idempotent, back-office. US-40, US-44, US-46. Tests : U (horloge simulée), I.
- [ ] **T-64b Concours : participation** (dép. T-64a) — US-41. Tests : U, I, E.
- [ ] **T-64c Concours : score et anti-triche** (dép. T-64b) — table `contest_like_signals` alimentée seulement pour les likes sur une participation d'un concours ouvert, `ip_hash` = HMAC par concours (clé dérivée de `CONTEST_IP_KEY` et de l'id du concours), préfixe `/64` en IPv6, alerte seulement au-delà de 10 likes comptés, purge 30 jours après `closed`. US-42, US-43. Tests : U, I.
- [ ] **T-64d Concours : résultats et archives** (dép. T-64c) — badges, hero, bandeau de quête. US-45, US-47. Tests : U, I, E.
- [ ] **T-65 Export de données** (dép. T-58) — US-06. Tests : U, I.
- [ ] **T-66 Partage depuis Android** (dép. T-26a) — US-66. Tests : E.
- [ ] **T-67 Publicité** (dép. T-58, Q2) — US-73, CSP conditionnelle. Tests : E.
- [ ] **T-68 Soutien : dons ponctuels** (dép. T-58, Q20, Q21) — US-76, table `donations` créée en T-05a avec le flag désactivé. Tests : U, I, E.
- [ ] **T-69 Soutien : badge et historique** (dép. T-68) — US-77, US-78. Tests : U, E.
- [ ] **T-70 Versions des Terms** (dép. T-58) — publication d'une nouvelle version avec date d'effet à J+15 minimum, notification in-app et email, écran de réacceptation (`/api/admin/legal`, `/api/me/terms/accept`). Au MVP : version acceptée enregistrée à l'inscription, changements annoncés à la main par email (20/11/2026). US-74.2–3. Tests : U, I, E.
- [ ] **T-71 Recours dans l'application** (dép. T-58) — table `appeals`, bouton « Appeal » sur la notification (6 mois, 20 à 2000 caractères, un recours par décision), traitement par un autre modérateur. Au MVP : recours par email, traités à la main (20/11/2026). US-52.4–5. Tests : U, I, E.
