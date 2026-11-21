# 11 — Stratégie de tests

Principe : **chaque critère d'acceptation (`US-xx.n`) est couvert par au moins un test automatisé tagué avec son identifiant**, écrit avant le code (TDD). Une tâche n'est terminée que si ses tests sont verts en CI.

## 1. Pyramide

| Niveau | Outil | Portée | Dépendances | Où | Volume visé |
|---|---|---|---|---|---|
| **Unitaire domaine** | Vitest | entités, objets valeur, politiques, calculs (qualité, éligibilité concours, score, seuils de modération, règles de repli US-70, validation de fichier, anti-spam) | aucune (TS pur, horloge fixe) | `server/modules/*/domain/**/*.test.ts`, `shared/**/*.test.ts` | le plus grand nombre |
| **Unitaire application** | Vitest | use cases avec fakes en mémoire des ports : autorisation, orchestration, erreurs métier, événements émis | `tests/fakes/*` | `server/modules/*/application/**/*.test.ts` | un fichier par use case |
| **Composants** | Vitest + @nuxt/test-utils + @vue/test-utils | composants UI (props → rendu, événements), composables de feature avec client API simulé | happy-dom | `app/**/*.test.ts` | composants UI : 100 % ; features : cas principaux |
| **Intégration adaptateurs** | Vitest | repositories Drizzle sur vraie base Postgres (requêtes, contraintes uniques, index de recherche, pagination), présignature R2, parsing des réponses fournisseurs (fixtures enregistrées) | Postgres (branche Neon de CI ou conteneur `postgres:16`), Miniflare | `server/modules/*/infrastructure/**/*.int.test.ts` | chaque repository |
| **Intégration API** | Vitest + `@nuxt/test-utils/e2e` (`$fetch` sur serveur de test) | routes HTTP de bout en bout côté serveur : contrats Zod, codes d'erreur, autorisation (matrice), limites de débit, idempotence | base de test + fakes fournisseurs | `tests/api/**/*.test.ts` | chaque route × cas nominal + refus |
| **Fonctionnels E2E** | Playwright | parcours utilisateur dans le navigateur, sur desktop et mobile ; PWA, hors ligne, accessibilité | preview déployée (CI) ou `pnpm dev` | `tests/e2e/**/*.spec.ts` | un fichier par story MVP |
| **Non fonctionnels** | Lighthouse CI, axe-core, OWASP ZAP | performance, accessibilité, en-têtes, scan de sécurité | preview | `tests/perf`, CI | sur chaque PR (ZAP : hebdomadaire) |

## 2. Couverture minimale (bloquante en CI)
| Périmètre | Lignes | Branches |
|---|---|---|
| `server/modules/*/domain`, `shared/domain` | 95 % | 90 % |
| `server/modules/*/application` | 90 % | 85 % |
| `app/components/ui` | 90 % | 80 % |
| Global | 80 % | 70 % |

La couverture ne remplace pas la traçabilité : un script `pnpm test:trace` vérifie que **chaque identifiant `US-xx.n` des stories [MVP] apparaît dans au moins un test** (`test('US-30.2 …')` ou annotation Playwright `{ tag: '@US-30.2' }`) et échoue sinon. Pendant le développement, seuls les critères des tâches cochées dans `06-plan-de-taches.md` sont exigés (T-01b, 20/11/2026) : ceux qu'une tâche cochée cite explicitement ; une story en entier, quand toutes les tâches qui la citent sont cochées (un critère qu'aucune tâche ne cite est alors signalé) ; un critère marqué `[v1.x, T-xx]`, quand T-xx est cochée. À la fin du MVP, toutes les tâches étant cochées, la règle s'applique à tous les critères [MVP].

## 3. Conventions d'écriture
- Nom du test = identifiant + comportement : `it('US-10.3 rejects a PNG whose bytes are an HTML file')`.
- Structure Given / When / Then reprise des AC ; un seul comportement par test.
- Données construites par des **builders** (`aCapture().published().withLikes(12).build()`) dans `tests/builders/` ; jamais de dépendance à l'ordre d'exécution.
- Temps : horloge injectée (`FixedClock`) côté serveur, `page.clock` côté Playwright ; aucun `sleep`.
- Aucun appel réseau réel en test (sauf scan ZAP sur preview) : fournisseurs remplacés par fakes ou par **MSW** pour les appels HTTP sortants.
- Fixtures de fichiers dans `tests/fixtures/images/` (JPEG, PNG, WebP, TGA valides aux formats réels 1920×1080, 3440×1440, 3840×2160, 5120×2160, 7680×4320 ; PNG de 25 Mo pour la chaîne de conversion ; blanc pur et noir pur pour le contraste) et `tests/fixtures/malicious/` (cf. `08-securite.md` § 11).

## 4. Fakes et doubles
| Port | Fake | Particularité |
|---|---|---|
| Repositories | `InMemory*Repository` | mêmes contraintes d'unicité que la base (test de contrat partagé avec l'adaptateur Drizzle) |
| ObjectStorage (R2) | `FakeObjectStorage` | stocke en mémoire, simule l'expiration des URLs présignées |
| ImageService (binding Images) | `FakeImageService` (dimensions et formats lus dans les en-têtes des fixtures, variantes factices, **compteur d'appels** : exactement 6 transformations par capture, 0 à l'affichage, US-14.6) ; le vrai binding est testé sur la preview | conforme ADR-011 et ADR-012 |
| RateLimiter | `FakeRateLimiter` (fenêtres pilotées par `FixedClock`) | même contrat que les adaptateurs binding et base |
| MetadataStripper | pas de fake : code pur testé directement sur le corpus de fixtures | pixels identiques avant/après |
| ModerationProvider | `FakeModerationProvider` | scores pilotés par le nom de fichier de fixture (`*_nsfw.jpg` → 0,95), mode panne |
| Mailer | `RecordingMailer` | boîte consultable par Playwright via `/__test/mailbox` (route active seulement si `NUXT_FAKE_PROVIDERS=true`) |
| OAuth | `FakeOAuthProvider` | page de consentement factice, comptes de test, erreurs simulées |
| GitHub | `RecordingIssueTracker` | enregistre le corps exact pour vérifier l'échappement |
| EventBus / Queues | `RecordingEventBus` ; en intégration, Queues Miniflare | vérifie l'idempotence par double livraison |
| Clock, IdGenerator | `FixedClock`, `SequentialIds` | déterminisme |

**Tests de contrat** : chaque port a une suite partagée (`tests/contracts/<port>.contract.ts`) exécutée contre le fake **et** contre l'adaptateur réel, pour garantir que les fakes ne mentent pas.

## 5. Parcours E2E obligatoires (MVP)
| Parcours | Stories | Projets Playwright |
|---|---|---|
| Inscription email → vérification par mail → choix du pseudo | US-01, US-05, US-08 | desktop, mobile |
| Connexion OAuth factice Google et Battle.net, liaison refusée sans confirmation | US-02 | desktop |
| Mot de passe oublié → reset → anciennes sessions invalides | US-03, US-04 | desktop |
| Upload JPEG et TGA (PUT navigateur réel vers R2 : CORS et CSP) → traitement → publication → visible dans la PLP et la recherche | US-10, US-11, US-14, US-20, US-21 | desktop, mobile |
| Upload d'un fichier noté NSFW → refus → notification | US-50, US-35 | desktop |
| PDP : like, commentaire, partage, téléchargement HD (connecté et visiteur) | US-23, US-30, US-31, US-32 | desktop, mobile |
| Signalement ×3 par comptes éligibles → masquage (×3 par comptes de moins de 7 jours → pas de masquage) → décision du modérateur (avec TOTP) → notification | US-51, US-52, US-55 | desktop |
| Staff : connexion OAuth puis TOTP exigé ; connexion avec un code de secours ; code réutilisé refusé | US-55.2, US-55.5 | desktop |
| Mode invitation : inscription sans invitation → liste d'attente ; lien d'invitation → inscription réussie | US-56.4–5 | desktop |
| Nouvelle version des Terms : notification, puis écran de réacceptation après la date d'effet (horloge simulée) — v1.x, T-70 | US-74.2–3 | desktop |
| Suspension puis tentative de publication | US-53 | desktop |
| Réglages : avatar, changement d'email, suppression du compte puis annulation | US-07, US-09 | desktop |
| Consentement : refus → aucun appel PostHog ; acceptation → événements | US-61, US-72 | desktop |
| Bascule FR/EN, contenus administrés traduits | US-62 | desktop |
| PWA : installabilité, hors ligne, mise à jour | US-63, US-64, US-65 | Chromium |
| Mobile : barre d'onglets, swipe PDP, bottom sheets, pas de défilement horizontal à 360 px | US-67 | iPhone 14, Pixel 7 |
| États vides sur base vierge | US-70 | desktop |
| Bug report : envoi, honeypot, limite, échappement | US-60 | desktop |
| XSS stockée sur titre, commentaire, bio, pseudo | `08-securite.md` § 11 | desktop |
| Accessibilité clavier : parcours inscription → upload → like sans souris, modales et visionneuse | US-75 | desktop |
| Décision automatique annulée par un modérateur (recours reçu par email au MVP ; formulaire de recours : v1.x, T-71) | US-52.6 | desktop |
| Réinscription d'un compte banni refusée | US-53.5 | desktop |

Chaque parcours vérifie aussi l'accessibilité de chaque page visitée avec `@axe-core/playwright` (aucune violation « serious » ou « critical »).

## 6. Données de test
- `pnpm db:seed` (local, preview) : versions du jeu, zones (`docs/seed/zones.csv`), 3 comptes (membre, modérateur avec TOTP de test, admin), 60 captures de démonstration libres de droits générées (dégradés), likes répartis sur tous les paliers de qualité.
- Les tests d'intégration créent leurs propres données dans une **transaction annulée** à la fin, ou dans un schéma dédié par worker Vitest.
- Les E2E s'exécutent sur une base de preview réinitialisée (`POST /__test/reset`, actif seulement avec `NUXT_FAKE_PROVIDERS=true`).

## 7. CI (GitHub Actions)
| Étape | Déclencheur | Bloquant |
|---|---|---|
| Install, lint (ESLint, Prettier), typecheck, dependency-cruiser, gitleaks | chaque push | oui |
| Vitest unitaires + composants + couverture + `test:trace` | chaque push | oui |
| Vitest intégration (Postgres de CI, Miniflare) | chaque PR | oui |
| Migrations : application sur base vierge **et** sur copie du schéma de production, puis rollback du code précédent compatible (expand/contract) | chaque PR | oui |
| Déploiement preview (ADR-013 : Worker, Queues, branche Neon, préfixe R2, seed) ; suppression de toutes ces ressources à la fermeture de la PR, balayage hebdomadaire des orphelins | chaque PR | oui |
| Playwright E2E (desktop, iPhone 14, Pixel 7) sur la preview, authentifié auprès de Cloudflare Access par jeton de service | chaque PR | oui |
| Vérification de l'artefact de production : aucune route `/__test`, aucun fournisseur factice | chaque PR | oui |
| Lighthouse CI (home, PLP, PDP) | chaque PR | oui (seuils US-68) |
| Semgrep CE (à la place de CodeQL, Q26), `pnpm audit --prod` | chaque PR | oui (Semgrep : toute alerte ; audit : haute/critique) |
| OWASP ZAP baseline | hebdomadaire + avant mise en production | oui (« High ») |
| Smoke test production (`/api/health` via Hyperdrive, home, PDP de référence, `/img` de référence servie puis `HIT` au second appel) | après déploiement | rollback automatique si échec |

## 8. Ce qui n'est pas testé automatiquement (et comment on le couvre)
- Rendu visuel exact par rapport aux maquettes : revue manuelle sur la preview avec captures Playwright jointes à la PR (`pnpm test:e2e --update-snapshots` interdit sans revue).
- Qualité réelle de la modération Sightengine : échantillon manuel mensuel des décisions automatiques.
- Lisibilité juridique des pages légales : relecture humaine (Q11).
