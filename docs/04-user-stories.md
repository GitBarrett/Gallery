# 04 — Epics et user stories

## Conventions
- Format : « En tant que [rôle], je veux [action] afin de [bénéfice] ». Critères d'acceptation (AC) en Given / When / Then, numérotés `US-xx.n`.
- **Chaque AC = au moins un test automatisé**, tagué avec son identifiant (`@US-41.2`) ; voir `11-strategie-de-tests.md`. Ligne « Tests » = niveaux attendus : **U** unitaire (domaine, use case), **I** intégration (API + base), **E** bout en bout (Playwright).
- Priorité : **[MVP]** livré avant l'ouverture publique ; **[v1.x]** ensuite. Une story v1.x peut être livrée derrière un flag (`site_settings.features.*`).
- Règles détaillées : `02-specs-fonctionnelles.md` ; sécurité : `08-securite.md`. En cas de contradiction, ce fichier fait foi pour le comportement attendu, `08-securite.md` pour la sécurité.
- Rôles : visiteur (non connecté), membre (connecté, email vérifié), modérateur, admin. « Membre non vérifié » = connecté mais email non vérifié.

## Carte des epics

| Epic | Objectif | Stories | Priorité |
|---|---|---|---|
| E-AUTH Comptes | S'inscrire, se connecter, gérer son compte, partir | US-01 à US-09, US-82 | MVP (US-06 v1.x) |
| E-UPLOAD Publication | Publier une capture propre et sûre | US-10 à US-14 | MVP |
| E-DISCOVER Découverte | Parcourir, chercher, voir, télécharger, partager | US-20 à US-25 | MVP (US-22 v1.x) |
| E-SOCIAL Communauté | Liker, commenter, suivre, collectionner, être notifié | US-30 à US-36 | MVP (US-33, US-34, US-36 v1.x) |
| E-CONTEST Concours | Animer la communauté par des concours | US-40 à US-47 | v1.x |
| E-MOD Modération et admin | Garder la communauté saine et piloter le site | US-50 à US-58 | MVP |
| E-PLATFORM Transverse | Langues, PWA, mobile, accessibilité, consentement, erreurs, légal | US-60 à US-69, US-72 à US-75 | MVP (US-66, US-73 v1.x) |
| E-QUALITY Qualité et démarrage | Rendre le système de qualité lisible, éviter les pages vides | US-70, US-71 | MVP |
| E-SUPPORT Soutien du site | Dons ponctuels de 2 € minimum, badge Supporter, historique | US-76 à US-78 | v1.1 |
| E-SECRETS Secrets et easter eggs | Surprises cachées et quête à indices, purement cosmétiques | US-79 à US-81 | MVP (US-79), v1.x (US-80, US-81) |

---

## E-AUTH — Comptes

### US-01 [MVP] Inscription par email
En tant que visiteur, je veux créer un compte avec email et mot de passe afin de publier des captures.
- US-01.1 Given un email libre, un pseudo valide, un mot de passe de 10 à 128 caractères et la case « I am at least 15 and accept the Terms and Privacy policy » cochée, When je valide avec Turnstile OK, Then un compte non vérifié est créé (`terms_accepted_at`, `terms_version` enregistrés) et un email de vérification (lien valable 24 h) est envoyé ; le message neutre « Check your inbox » s'affiche (sans session, comme pour un email déjà utilisé) et l'ouverture du lien vérifie l'email et me connecte (Q44).
- US-01.7 Given la case d'acceptation non cochée, When je valide, Then l'inscription est refusée (client et serveur).
- US-01.2 Given un email déjà utilisé, When je valide, Then le même message neutre « Check your inbox » s'affiche et l'email reçu par le titulaire indique qu'un compte existe déjà (pas d'énumération).
- US-01.3 Given un mot de passe présent dans une fuite connue (HIBP, k-anonymat), When je valide, Then il est refusé avec un message explicite.
- US-01.4 Given un lien de vérification valide, When je l'ouvre, Then `email_verified_at` est renseigné, le lien devient inutilisable, et je suis redirigé vers mon profil.
- US-01.5 Given un lien expiré, When je l'ouvre, Then un bouton « Resend » est proposé (3 envois maximum par heure).
- US-01.6 Given Turnstile absent ou invalide, When je valide, Then l'inscription est refusée (400).
- Tests : U (règles mot de passe, pseudo), I (API, unicité, jeton haché), E (parcours complet avec boîte mail simulée).

### US-02 [MVP] Connexion Google et Battle.net
En tant que visiteur, je veux me connecter avec Google ou Battle.net afin de ne pas gérer de mot de passe.
- US-02.1 Given un premier login OAuth réussi, When je reviens sur le site, Then je suis redirigé vers l'étape « pseudo + acceptation des Terms (15 ans minimum) » ; le compte n'est créé qu'à sa validation, avec l'email vérifié par le fournisseur s'il en donne un.
- US-02.2 Given un compte OAuth déjà lié, When je me reconnecte, Then je suis connecté sans étape supplémentaire.
- US-02.3 Given un email fourni par OAuth identique à un compte email existant, When je me connecte, Then aucune fusion automatique n'a lieu : je dois me connecter au compte existant pour confirmer la liaison.
- US-02.4 Given un paramètre `state` absent, rejoué ou différent, When le callback arrive, Then il est rejeté (400) et aucune session n'est créée.
- US-02.5 Given un refus ou une erreur du fournisseur, When je reviens, Then un message traduit s'affiche et je peux réessayer.
- US-02.6 Given Battle.net, When je me connecte, Then l'autorisation passe par l'hôte global `oauth.battle.net` (toutes régions hors Chine, aucun choix de région demandé) ; Battle.net ne fournissant pas d'email, la vérification d'email est demandée avant la première publication.
- Tests : U (règles de liaison), I (callback avec fournisseur simulé, state/PKCE), E (parcours avec fournisseur factice).

### US-03 [MVP] Connexion, déconnexion et sessions
En tant que membre, je veux me connecter et me déconnecter en sécurité.
- US-03.1 Given des identifiants valides, When je me connecte, Then une session est créée (cookie `HttpOnly`, `Secure`, `SameSite=Lax`, durée 30 jours glissants) et un nouvel identifiant de session est émis.
- US-03.2 Given des identifiants invalides, When je me connecte, Then le message est identique que l'email existe ou non.
- US-03.3 Given 5 échecs en 15 min sur un compte ou une IP, When je retente, Then Turnstile est exigé ; après 20 échecs en 1 h, la connexion par mot de passe est bloquée 1 h pour ce compte (email d'alerte au titulaire).
- US-03.4 Given que je me déconnecte, When l'action aboutit, Then la session est révoquée côté serveur, le cookie supprimé et les caches utilisateur du service worker vidés.
- US-03.5 Given un compte banni ou supprimé, When une requête arrive avec une session existante, Then elle est refusée (401) et la session révoquée.
- US-03.6 Given le paramètre `redirect` après connexion, When il pointe hors du site, Then il est ignoré (redirection vers `/`).
- US-03.7 Given que je suis connecté, When j'ouvre mes réglages, Then je vois mes sessions actives (appareil lisible, ouverture, dernière activité), la session courante signalée.
- US-03.8 Given une autre de mes sessions, When je la révoque, Then elle est refusée (401) à la requête suivante ; la session d'un autre membre ou inconnue répond 404.
- US-03.9 Given plusieurs sessions, When je révoque toutes les autres, Then seule la session courante reste active.
- Tests : U (politique de verrouillage), I (sessions, révocation), E (connexion, déconnexion).

### US-04 [MVP] Mot de passe oublié
- US-04.1 Given un email saisi, When je demande la réinitialisation, Then un lien valable 1 h est envoyé si le compte existe, avec un message identique dans tous les cas.
- US-04.2 Given un lien expiré ou déjà utilisé, When je l'ouvre, Then il est refusé avec un lien pour recommencer.
- US-04.3 Given un reset réussi, When il se termine, Then toutes les sessions du compte sont révoquées (y compris la courante), puis je suis reconnecté.
- US-04.4 Given plus de 3 demandes par heure pour un email ou 10 par IP, When j'en fais une de plus, Then elle est ignorée silencieusement (même message).
- US-04.5 Given un reset réussi, When il se termine, Then les autres liens de reset du compte encore valables sont annulés et l'email du compte est marqué vérifié (le lien prouve la maîtrise de la boîte, Q52).
- US-04.6 Given un reset réussi, When il se termine, Then le titulaire reçoit un email « mot de passe modifié » avec un lien pour recommencer si ce n'était pas lui (Q52).
- Tests : U, I, E.

### US-05 [MVP] Pseudo et profil public
En tant que membre, je veux un pseudo et un profil afin d'être reconnu par la communauté.
- US-05.1 Given un pseudo de 3 à 24 caractères `[a-zA-Z0-9_-]`, non réservé et libre (insensible à la casse), When je le valide, Then il est enregistré.
- US-05.2 Given un pseudo pris, réservé (`admin`, `moderator`, `support`, noms de routes) ou contenant une insulte, When je le saisis, Then une erreur s'affiche en moins de 500 ms.
- US-05.3 Given un profil, When un visiteur ouvre `/u/{pseudo}`, Then il voit avatar, bio, captures publiées (pas `pending_review` ni `hidden`), collections publiques (v1.x) et statistiques (compteurs < 10 masqués, cf. US-70).
- US-05.4 Given un pseudo changé, When on ouvre l'ancienne URL de profil, Then elle redirige (301) vers la nouvelle pendant 90 jours ; un pseudo ne peut changer qu'une fois tous les 30 jours.
- Tests : U, I, E.

### US-06 [v1.x] Export de mes données
- US-06.1 Given une demande d'export, When elle est traitée (file d'attente), Then je reçois par email un lien signé valable 7 jours vers une archive (JSON + originaux).
- US-06.2 Given une demande déjà en cours, When j'en refais une, Then elle est refusée (1 export par 7 jours).
- Avant la v1.x : export sur demande à l'adresse de confidentialité (traitement manuel sous 30 jours).
- Tests : U, I.

### US-07 [MVP] Réglages du compte
En tant que membre, je veux gérer mes informations dans `/settings`.
- US-07.1 Given `/settings`, When je modifie bio (≤ 300 caractères, filtre d'insultes) ou langue, Then c'est enregistré et visible immédiatement.
- US-07.6 Given un nouvel avatar (JPEG, PNG ou WebP ≤ 2 Mo, recadré carré), When je l'envoie, Then il passe par la modération automatique (US-50) ; tant qu'il n'est pas validé, l'ancien avatar reste affiché ; refusé, je suis notifié.
- US-07.2 Given un changement d'email, When je le valide, Then mon mot de passe actuel est exigé (si j'en ai un), un lien de confirmation part à la nouvelle adresse et une alerte à l'ancienne ; l'email ne change qu'après confirmation.
- US-07.3 Given un changement de mot de passe, When je le valide avec l'ancien, Then les autres sessions sont révoquées.
- US-07.4 Given mes comptes liés (Google, Battle.net), When j'en délie un, Then c'est refusé s'il ne me resterait aucun moyen de connexion.
- US-07.5 Given mes préférences de notification (US-35), When je les modifie, Then elles s'appliquent aux prochaines notifications.
- Tests : U, I, E.

### US-82 [MVP] Réseaux sociaux du profil
- US-82.1 Given `/settings`, When je renseigne un ou plusieurs réseaux parmi une liste fixe (Twitch, YouTube, X, Bluesky, Instagram, TikTok, Reddit, Discord, site web), Then seul l'**identifiant** est saisi et enregistré (ex. `luneblade` pour Twitch), jamais une URL libre, sauf pour le site web.
- US-82.2 Given un identifiant saisi, When je l'enregistre, Then il est validé par le format propre au réseau (ex. Twitch `^[a-zA-Z0-9_]{4,25}$`, YouTube `^@[A-Za-z0-9._-]{3,30}$`, Bluesky nom de domaine) et par le filtre d'insultes ; sinon une erreur précise s'affiche.
- US-82.3 Given le site web, When je le saisis, Then seule une URL `https://` est acceptée (pas d'IP, pas de raccourcisseur de liens connu, ≤ 200 caractères) et le profil en affiche le **domaine** seul.
- US-82.4 Given un profil public avec des réseaux, When un visiteur l'ouvre, Then chaque réseau s'affiche avec une icône maison et un lien construit par le serveur à partir d'un gabarit fixe (ex. `https://twitch.tv/{id}`), avec `rel="nofollow ugc noopener noreferrer"` et `target="_blank"` ; Discord n'a pas de lien : un bouton copie l'identifiant.
- US-82.5 Given un compte sanctionné (suspendu ou banni) ou créé il y a moins de 7 jours, When son profil s'affiche, Then les liens ne sont pas affichés (anti-spam), les identifiants restent dans les réglages.
- US-82.6 Given un lien signalé par un visiteur (signalement de profil, US-50), When un modérateur le juge abusif, Then il peut l'effacer ; l'action est auditée et notifiée avec son motif.
- Tests : U (validation par réseau, construction des URL), I (stockage, masquage US-82.5), E (saisie puis affichage).

### US-08 [MVP] Vérification d'email avant publication
- US-08.1 Given un membre non vérifié, When il ouvre `/upload`, commente ou participe à un concours, Then l'action est bloquée avec un bandeau « Verify your email » et un bouton de renvoi.
- US-08.2 Given un membre non vérifié, When il like ou suit, Then c'est autorisé.
- Tests : U (politique d'autorisation), E.

### US-09 [MVP] Supprimer mon compte
En tant que membre, je veux supprimer mon compte et mes données.
- US-09.1 Given `/settings`, When je demande la suppression et confirme (mot de passe ou réauthentification OAuth), Then le compte passe en `pending_deletion`, je suis déconnecté et reçois un email avec un lien d'annulation.
- US-09.2 Given 30 jours sans annulation, When la tâche planifiée passe, Then compte, captures (base + R2, originaux et variantes), avatar, commentaires, likes, follows, collections, notifications, signalements émis, recours, téléchargements, participations et badges, codes de secours, compteurs de limites, sessions, jetons et liens OAuth sont supprimés ; `bug_reports.user_id` est mis à NULL ; la personne PostHog est supprimée ; les issues GitHub ne contiennent déjà aucune donnée personnelle ; dans `audit_log`, `moderation_decisions` et `sanctions`, l'identifiant est remplacé par un pseudonyme.
- US-09.5 Given un compte banni qui demande sa suppression, When la purge passe, Then une empreinte HMAC de son email et de ses identifiants OAuth est conservée 1 an dans `banned_identities` (base légale : intérêt légitime, mentionnée dans la politique de confidentialité).
- US-09.3 Given un compte `pending_deletion`, When on ouvre son profil ou ses captures, Then ils ne sont plus visibles publiquement.
- US-09.4 Given que j'annule avant 30 jours via le lien, When je me reconnecte, Then tout est restauré.
- Tests : U, I (cascade complète vérifiée en base et sur R2 simulé), E.

---

## E-UPLOAD — Publication

### US-10 [MVP] Uploader une capture
En tant que membre vérifié, je veux publier une capture afin de la partager.
- US-10.1 Given un fichier JPEG, PNG, WebP ou TGA ≤ 20 Mo, entre 640 et 7680 px sur le grand côté et ≤ 33,2 Mpx (jusqu'au 8K 7680 × 4320), When je l'envoie avec un titre et une version, Then la capture passe en `processing` puis suit la modération (US-50) ; un TGA est d'abord converti en PNG sans perte dans le navigateur.
- US-10.2 Given un fichier hors limites, When je le sélectionne, Then il est refusé côté client avec le motif, et la même règle est revérifiée côté serveur (une requête qui contourne le client est refusée).
- US-10.3 Given un fichier dont le contenu réel ne correspond pas à un format autorisé (octets magiques), ou dont les dimensions dépassent 7680 px ou 33,2 Mpx, When il est traité, Then il est rejeté, l'objet R2 supprimé et l'auteur notifié.
- US-10.4 Given une capture publiée, When je télécharge l'original, Then il ne contient plus aucune métadonnée EXIF/XMP/IPTC, mais conserve son profil de couleur (ICC) : pixels et couleurs identiques à l'envoi.
- US-10.5 Given 20 uploads sur les dernières 24 h, When j'en tente un 21e, Then il est refusé (429) avec l'heure de déblocage.
- US-10.6 Given une URL d'upload présignée, When elle est utilisée après 10 min, avec une autre taille ou un autre type de contenu que déclaré, Then R2 la refuse ou, à défaut, `complete` constate l'écart (`R2.head`), supprime l'objet et répond 422.
- US-10.7 Given un upload interrompu (fichier jamais complété), When 24 h passent, Then la capture `processing` orpheline et l'objet sont supprimés.
- US-10.9 Given un TGA ou un PNG de plus de 20 Mo, When je le sélectionne, Then il est converti dans le navigateur en WebP sans perte, sans avertissement ; si le résultat dépasse encore 20 Mo, il est converti en JPEG qualité 95 (4:4:4) avec un avertissement qui indique la perte ; jamais en WebP avec perte.
- US-10.10 Given une conversion qui échoue faute de mémoire (mobile), When elle s'interrompt, Then le message « Convert this file on a computer » s'affiche et l'onglet reste utilisable.
- US-10.8 Given une capture en traitement, When le traitement échoue de manière transitoire, Then il est réessayé 3 fois puis la capture passe en `failed` et l'auteur est invité à recommencer.
- Tests : U (validation fichier, quotas), I (pipeline avec R2 et Queue simulés, fichiers piégés), E (upload JPEG et TGA réels).

### US-11 [MVP] Métadonnées, zone et tags
- US-11.1 Given le formulaire, When je tape un tag, Then des tags existants sont suggérés ; 10 tags maximum, 2 à 30 caractères, normalisés en minuscules sans accents.
- US-11.2 Given le champ Zone, When je tape « Hurl » ou « Stormw », Then « Stormwind City / Hurlevent » est proposé.
- US-11.3 Given une zone absente du dictionnaire, When je la saisis librement, Then la capture est publiée avec `zone_custom` et la zone part en validation (US-57).
- US-11.4 Given des métadonnées renseignées (zone, heure en jeu, réglages, personnage, légende), When on ouvre la capture, Then elles s'affichent dans l'infobulle façon objet.
- US-11.5 Given un titre vide, de plus de 100 caractères ou contenant une insulte, When je valide, Then le formulaire refuse avec le motif.
- Tests : U, I, E.

### US-12 [MVP] Modifier ou supprimer sa capture
- US-12.1 Given ma capture, When je modifie titre, description, tags, zone ou métadonnées, Then les changements sont visibles sans nouvelle modération d'image ; le texte repasse le filtre d'insultes.
- US-12.2 Given ma capture, When je la supprime et confirme, Then elle disparaît partout (grilles, recherche, collections, classements) et l'objet R2 est déplacé dans `trash/` (purge automatique sous 30 jours).
- US-12.3 Given la capture d'un autre membre, When j'appelle l'API de modification ou de suppression, Then c'est refusé (403).
- US-12.4 Given une capture inscrite à un concours `open`, When je la supprime, Then la participation est retirée ; si le concours est `judging` ou `closed`, la suppression reste possible mais le podium garde la mention « capture removed ».
- Tests : U (règles de propriété), I, E.

### US-13 [MVP] Point focal et recadrage
- US-13.1 Given l'aperçu d'upload ou de modification, When je touche un point de l'image, Then le point focal est enregistré et utilisé pour les recadrages (grilles, hero, bannières).
- US-13.2 Given aucun point focal, When l'image est recadrée, Then le centre est utilisé.
- Tests : U, E.

### US-14 [MVP] Traitement et publication
- US-14.1 Given un fichier conforme, When le consommateur `photo-process` le traite, Then les métadonnées sont supprimées sans réencodage (pixels de l'original identiques), dimensions et luminances (`luma_bl`, `luma_tr`) enregistrées, les variantes WebP 400/800/1200/2400 et le JPEG 1200 écrits dans R2, puis la modération est appelée avec le JPEG 1200.
- US-14.2 Given un même message livré deux fois (livraison « au moins une fois »), When il est retraité, Then le résultat est identique et aucun doublon n'est créé (idempotence).
- US-14.3 Given la capture publiée, When le traitement se termine, Then l'auteur reçoit la notification correspondante (publiée, en revue ou refusée).
- US-14.4 Given ma capture non publiée (`processing`, `pending_review`, `hidden`, `rejected`, `failed`), When j'ouvre « My captures », Then je la vois avec son statut via l'aperçu privé ; un autre membre ou un visiteur obtient 404 sur la même image.
- US-14.5 Given une capture 7680 × 4320 (JPEG de 20 Mo) et une capture 5120 × 2160 (PNG de 20 Mo), When elles sont traitées, Then le consommateur termine sans dépassement mémoire (test de charge sur la preview avec 3 traitements simultanés).
- US-14.6 Given une capture publiée, When elle est affichée 1 000 fois dans le mois à toutes les largeurs, Then aucune transformation n'est appelée à l'affichage : le traitement initial en a appelé exactement 6 (ADR-012, garde FinOps vérifiée par le compteur du `FakeImageService`).
- Tests : U, I.

---

## E-DISCOVER — Découverte

### US-20 [MVP] Parcourir la galerie
- US-20.1 Given la home ou une PLP `/v/{version}`, When je l'ouvre, Then la grille masonry n'affiche que les captures `published` de cette version, par pages de 30 (pagination par curseur), triées par récence.
- US-20.2 Given le bas de la grille, When j'y arrive, Then la page suivante se charge ; à la fin, un message « You've seen everything » s'affiche.
- US-20.3 Given les filtres (zone, moment de la journée, qualité minimale, tri récent / populaire / téléchargements), When je les change, Then l'URL reflète les filtres (partageable, retour arrière fonctionnel).
- US-20.4 Given une version archivée ou inexistante, When j'ouvre son URL, Then une 404 s'affiche (US-69).
- Tests : U (construction de requête), I (pagination stable sans doublon ni trou), E.

### US-21 [MVP] Rechercher
- US-21.1 Given « Nagrand », When je valide, Then les captures taguées, titrées ou situées à Nagrand s'affichent, triables par pertinence, récence ou popularité.
- US-21.2 Given « Suramr » (faute de frappe), When je valide, Then les captures de Suramar s'affichent avec « Showing results for Suramar ».
- US-21.3 Given 3 caractères « Hur », When je tape, Then zones et tags correspondants sont suggérés en moins de 300 ms (p95).
- US-21.4 Given « Stormwind », « Hurlevent » ou « SW », When je valide, Then exactement les mêmes captures de la zone Stormwind City s'affichent.
- US-21.5 Given un visiteur en français, When il ouvre une capture prise à Stormwind City, Then la zone s'affiche « Hurlevent » ; en anglais, « Stormwind City ».
- US-21.6 Given une recherche sans résultat, When elle se termine, Then suggestions orthographiques, tags populaires et dernières captures sont proposés.
- US-21.7 Given une requête de plus de 100 caractères ou contenant des caractères de contrôle, When elle est envoyée, Then elle est tronquée/nettoyée sans erreur serveur.
- Tests : U, I (jeux de données de recherche), E.

### US-22 [v1.x] Classement
- US-22.1 Given `/leaderboard`, When je l'ouvre, Then podium et rangs 4 à 10 s'affichent ; « Show ranks 11 – 50 » charge les 40 suivants. Le classement s'arrête à 50.
- US-22.2 Given plus de 50 captures sur la période, When j'arrive en bas, Then « Browse all {n} by likes » ouvre la PLP filtrée sur la période, triée par likes.
- US-22.3 Given que je suis connecté et ai publié sur la période, When j'ouvre le classement, Then « Your best this week » montre le rang de ma meilleure capture et l'écart avec le palier suivant (#200, #100, #50, #10).
- US-22.4 Given des milliers de captures, When le classement est servi, Then il vient de `leaderboard_snapshots` recalculé toutes les 5 min, jamais d'un tri à la volée.
- US-22.5 Given le filtre de version ou de période (semaine, mois, tout), When je le change, Then classement et « Your best » sont recalculés.
- Tests : U (calcul de rang, égalités), I, E.

### US-23 [MVP] Télécharger en haute définition
- US-23.1 Given une capture, When un membre clique Télécharger, Then l'original nettoyé est servi via une URL signée de 5 min avec `Content-Disposition: attachment` et `downloads_count` est incrémenté (une fois par membre et par capture et par 24 h).
- US-23.2 Given un visiteur, When il clique, Then il est invité à se connecter puis le téléchargement reprend.
- US-23.3 Given 100 téléchargements en 1 h par un même compte, When il en demande un de plus, Then c'est refusé (429).
- Tests : U, I, E.

### US-24 [MVP] Page d'accueil
- US-24.1 Given la home, When elle s'affiche, Then le hero montre l'image choisie par l'admin (`site_settings.hero`) avec voile de contraste, titre, deux CTA et crédit de l'auteur lié à la PDP.
- US-24.2 Given la home, When elle s'affiche, Then « Capture of the week », onglets de version et dernières captures suivent les règles de repli de US-70.
- US-24.3 Given un concours `open`, When la home s'affiche, Then le bandeau de quête l'annonce ; sinon le bandeau est masqué.
- Tests : I, E.

### US-25 [MVP] Référencement et aperçus de partage
- US-25.1 Given une PDP, When un robot la récupère, Then le HTML est rendu côté serveur avec titre, description, `og:image` (`/img/{id}/og.jpg`, JPEG 1200 px), `twitter:card=summary_large_image`, URL canonique et `hreflang` en/fr.
- US-25.2 Given `/sitemap.xml`, When il est demandé, Then il liste les PLP, les profils actifs et les captures publiées (index par lots de 10 000), mis à jour quotidiennement.
- US-25.3 Given une capture `hidden`, `rejected`, supprimée ou un profil supprimé, When un robot ou un visiteur l'ouvre, Then 404 (ou 410 pour une suppression) et absence du sitemap.
- US-25.4 Given `/robots.txt`, When il est demandé, Then `/admin`, `/settings`, `/api`, `/upload` sont exclus ; les environnements de preview répondent `Disallow: /` et `X-Robots-Tag: noindex`.
- Tests : I, E.

---

## E-SOCIAL — Communauté

### US-30 [MVP] Liker
- US-30.1 Given une capture publiée d'un autre membre, When je like, Then le compteur augmente de 1 et le bouton passe à l'état « liké » ; une seconde action retire le like.
- US-30.2 Given ma propre capture, When j'essaie de la liker, Then le bouton est désactivé et l'API refuse (403).
- US-30.3 Given deux likes simultanés du même compte, When ils arrivent, Then un seul est compté (contrainte unique).
- US-30.4 Given un visiteur, When il clique Like, Then il est invité à se connecter.
- US-30.5 Given plus de 120 likes en 1 h pour un compte, When il en ajoute un, Then c'est refusé (429).
- US-30.6 Given un like qui fait franchir un seuil de qualité, When il est enregistré, Then la qualité de la capture est mise à jour et l'auteur notifié (US-71.4).
- Tests : U, I (concurrence), E.

### US-31 [MVP] Commenter
- US-31.1 Given une capture, When un membre vérifié publie un commentaire de 1 à 1000 caractères, Then il apparaît immédiatement, rendu en texte brut (aucun HTML ni Markdown interprété, liens non cliquables).
- US-31.2 Given un commentaire contenant une insulte de la liste, When je l'envoie, Then il est bloqué avec un message.
- US-31.3 Given mon commentaire de moins de 15 min, When je l'édite, Then il est mis à jour avec la mention « edited » ; après 15 min, l'édition est refusée.
- US-31.4 Given mon commentaire, ou un commentaire sous ma capture, When je le supprime, Then il est retiré définitivement (les commentaires sont à plat, sans réponses imbriquées).
- US-31.5 Given plus de 10 commentaires en 10 min pour un compte, When il en envoie un autre, Then c'est refusé (429) ; Turnstile est demandé si le compte a moins de 24 h.
- US-31.6 Given 0 commentaire, When j'ouvre la PDP, Then « Be the first to comment » s'affiche.
- Tests : U, I, E.

### US-32 [MVP] Partager
- US-32.1 Given une capture, When je clique Share sur mobile, Then la feuille de partage native s'ouvre (`navigator.share`) ; sinon un menu propose copie du lien, X, Facebook, Reddit, Discord.
- US-32.2 Given le lien collé sur un réseau, When l'aperçu se génère, Then il affiche l'image 1200 px, le titre et l'auteur (US-25.1).
- US-32.3 Given un partage, When il est déclenché, Then l'événement `photo_shared` est envoyé à PostHog si consenti (US-72).
- Tests : E.

### US-33 [v1.x] Suivre un photographe
- US-33.1 Given un profil, When je clique Follow, Then le nombre d'abonnés augmente et ses nouvelles captures apparaissent dans mon fil `/following`.
- US-33.2 Given mon propre profil, When j'essaie de me suivre, Then c'est refusé.
- US-33.3 Given un fil vide, When je l'ouvre, Then 6 photographes actifs sont suggérés (US-70).
- Tests : U, I, E.

### US-34 [v1.x] Collections
- US-34.1 Given une capture, When je l'ajoute à une collection (nouvelle ou existante), Then elle y figure ; 50 collections et 500 captures par collection au maximum.
- US-34.2 Given une collection privée, When un autre membre ou un visiteur tente de l'ouvrir, Then 404.
- US-34.3 Given une capture supprimée, When j'ouvre la collection, Then elle n'apparaît plus.
- Tests : U, I, E.

### US-35 [MVP] Notifications in-app (« Quest log »)
- US-35.1 Given un événement (like groupé, commentaire, nouvel abonné, décision de modération, palier de qualité, concours), When il survient, Then une notification est créée et le compteur de la cloche s'incrémente (rafraîchi au chargement et toutes les 60 s quand l'onglet est visible).
- US-35.2 Given plusieurs likes sur la même capture en 1 h, When ils arrivent, Then une seule notification groupée « X and N others liked… ».
- US-35.3 Given `/notifications`, When je l'ouvre, Then les notifications sont groupées « Today / Earlier », non lues en jaune, lues en gris ; « Mark all as read » fonctionne.
- US-35.4 Given une préférence désactivée (likes, commentaires, abonnés, concours), When l'événement survient, Then aucune notification n'est créée ; les décisions de modération ne peuvent pas être désactivées.
- US-35.5 Given des notifications de plus de 6 mois, When la purge quotidienne passe, Then elles sont supprimées.
- Tests : U (regroupement, préférences), I, E.

### US-36 [v1.x] Récapitulatif par email
- US-36.1 Given le récap activé et des notifications non lues, When le lundi 08:00 UTC arrive, Then un email résume les notifications de la semaine, avec un lien de désinscription en un clic (sans connexion).
- US-36.2 Given aucune notification non lue, When le lundi arrive, Then aucun email n'est envoyé.
- Tests : U, I.

---

## E-CONTEST — Concours [v1.x]
Règles de référence : `02-specs-fonctionnelles.md` §5.

### US-40 Créer et programmer un concours (admin)
- US-40.1 Given un admin, When il crée un concours avec titre EN/FR, thème, dates et critères, Then il est enregistré en `draft`, puis passe en `scheduled` à la publication.
- US-40.2 Given une durée hors 7–30 jours ou une bannière de luminance > 0,6, When il enregistre, Then l'enregistrement est refusé avec le motif.
- US-40.3 Given un concours `open`, When l'admin modifie les critères ou avance la date de fin, Then c'est refusé ; allonger la fin ou modifier la description est accepté.
- US-40.4 Given la date de début atteinte, When le cron passe, Then le concours devient `open` et les membres abonnés aux concours sont notifiés.
- US-40.5 Given un modérateur ou un membre, When il appelle l'API de création, Then 403.
- Tests : U (machine à états), I, E.

### US-41 Participer
- US-41.1 Given un membre vérifié de plus de 7 jours, When il ouvre « Accept quest », Then seules ses captures éligibles sont sélectionnables, les autres affichent leur motif (zone, date, déjà inscrite ailleurs).
- US-41.2 Given une participation active, When il en soumet une deuxième, Then c'est refusé.
- US-41.3 Given un compte de moins de 7 jours, suspendu ou exclu des concours, When il ouvre la page, Then le bouton est désactivé avec la raison.
- US-41.4 Given sa participation, When il la retire avant la fin, Then elle sort du classement et il peut en soumettre une autre.
- US-41.5 Given une capture d'un autre membre, When il tente de l'inscrire via l'API, Then 403.
- Tests : U (éligibilité), I, E.

### US-42 Classement en direct
- US-42.1 Given un concours `open`, When j'ouvre la page, Then le classement (recalculé toutes les 5 min) montre rang, capture, auteur et score.
- US-42.2 Given des likes venant de comptes de moins de 7 jours, suspendus ou bannis, When le score est calculé, Then ils ne comptent pas.
- US-42.3 Given deux participations à égalité, When le classement est calculé, Then la plus ancienne passe devant.
- US-42.4 Given l'option « vote à l'aveugle », When le concours est `open`, Then les scores sont masqués et l'ordre est aléatoire mais stable par visiteur.
- Tests : U (score, égalités), I, E.

### US-43 Anti-triche et disqualification
- US-43.1 Given au moins 10 likes comptés et plus de 30 % venant de comptes créés après le début, ou plus de 20 % d'une même adresse (HMAC propre au concours, `/64` en IPv6, table `contest_like_signals`), When le classement est calculé, Then une alerte apparaît dans la file de modération.
- US-43.2 Given un modérateur, When il disqualifie une participation avec un motif, Then elle sort du classement et l'auteur est notifié du motif et de la voie de recours.
- US-43.3 Given 2 disqualifications pour triche, When le membre ouvre un concours pendant 90 jours, Then il ne peut pas participer.
- Tests : U, I.

### US-44 Clôture, vérification et prolongation
- US-44.1 Given la fin atteinte avec au moins 10 participations, When le cron passe, Then le concours passe en `judging`, scores et participations gelés 48 h.
- US-44.2 Given moins de 10 participations à la fin, When le cron passe, Then la fin est repoussée de 7 jours une seule fois et les participants sont notifiés.
- US-44.3 Given moins de 3 participations à la fin prolongée, When le cron passe, Then clôture sans podium, badge de participation pour chacun.
- US-44.4 Given le cron exécuté deux fois sur la même fenêtre, When il passe, Then aucune transition n'est appliquée deux fois (idempotence).
- Tests : U (machine à états avec horloge simulée), I.

### US-45 Résultats et récompenses
- US-45.1 Given la fin de `judging`, When le concours passe en `closed`, Then podium affiché, badges attribués, participants notifiés.
- US-45.2 Given une capture gagnante de luminance ≤ 0,6, When les résultats sont publiés, Then elle devient le hero de la home pendant 7 jours avec un lien vers le concours.
- US-45.3 Given une capture gagnante, When on ouvre sa PDP, Then un bandeau « Contest winner » s'affiche.
- Tests : U, I, E.

### US-46 Annuler un concours (admin)
- US-46.1 Given un concours non clos, When l'admin l'annule avec un motif, Then les participations sont libérées et les participants notifiés.
- US-46.2 Given un concours annulé, When on ouvre sa page, Then elle affiche « Cancelled » et le motif, sans classement ni bouton de participation.
- Tests : U, I.

### US-47 Concours passés et à venir
- US-47.1 Given `/contests`, When je l'ouvre, Then je vois le concours en cours, les prochains et les archives avec leur gagnant.
- US-47.2 Given aucun concours passé ni prévu, When j'ouvre `/contests`, Then un état vide explique le principe des concours.
- Tests : I, E.

---

## E-MOD — Modération et administration

### US-50 [MVP] Modération automatique
- US-50.1 Given un score max ≥ seuil haut (défaut 0,85), Then la capture est `rejected`, l'objet déplacé dans `trash/` et l'auteur notifié avec le motif et la voie de recours.
- US-50.2 Given seuil bas ≤ score < seuil haut (défaut 0,5), Then `pending_review` et entrée dans la file de modération.
- US-50.3 Given score < seuil bas, Then `published`.
- US-50.4 Given Sightengine indisponible, When l'appel échoue 3 fois (backoff exponentiel), Then `pending_review`.
- US-50.5 Given un admin qui change les seuils dans `site_settings`, When une nouvelle capture est traitée, Then les nouveaux seuils s'appliquent sans redéploiement.
- US-50.6 Given chaque décision automatique, When elle est prise, Then elle est historisée (`moderation_decisions`, source `auto`, scores bruts).
- Tests : U (seuils), I (fournisseur simulé, pannes).

### US-51 [MVP] Signaler un contenu
- US-51.1 Given une capture, un commentaire ou un profil, When un membre le signale avec un motif (nudity, violence or gore, hate or harassment, spam, stolen capture or copyright, personal information, other + commentaire), Then le signalement est enregistré et confirmé.
- US-51.6 Given un motif « stolen capture or copyright », When il est traité, Then le modérateur peut demander une preuve à l'auteur ; la procédure de notification des titulaires de droits non inscrits passe par l'adresse de signalement des mentions légales.
- US-51.2 Given 3 signalements (`moderation.reportsToHide`) de membres distincts, vérifiés depuis plus de 7 jours et non sanctionnés, Then le contenu passe en `hidden` et entre dans la file de modération ; les signalements des autres comptes alimentent la file sans masquer.
- US-51.3 Given un membre qui a déjà signalé ce contenu, When il resignale, Then rien ne change.
- US-51.4 Given plus de 20 signalements en 24 h par un même compte, When il en fait un autre, Then c'est refusé (429).
- US-51.5 Given un visiteur, When il veut signaler, Then il est invité à se connecter ou à écrire à l'adresse de signalement (mentions légales).
- Tests : U, I, E.

### US-52 [MVP] File de modération
- US-52.1 Given un modérateur, When il ouvre `/admin/moderation`, Then il voit les contenus `pending_review`, `hidden` et les alertes, triés du plus ancien au plus récent, avec scores et signalements.
- US-52.2 Given un modérateur, When il publie, masque ou supprime un contenu avec un motif, Then la décision est appliquée, historisée et l'auteur notifié (motif, règle, automatisation, recours).
- US-52.3 Given un membre, When il appelle une API `/api/admin/*`, Then 403.
- US-52.4 [v1.x, T-71] Given un recours d'un auteur, When un modérateur le traite, Then ce ne peut pas être celui qui a pris la décision initiale.
- US-52.5 [v1.x, T-71] Given la notification d'une décision me concernant, When je clique « Appeal » dans les 6 mois et écris un message (20 à 2000 caractères), Then le recours est enregistré, confirmé et un seul recours est possible par décision.
- US-52.6 Given une décision automatique contestée, When un modérateur traite le recours, Then il voit les scores bruts et peut annuler la décision (capture republiée, auteur notifié).
- Tests : U, I, E.

### US-53 [MVP] Sanctions
- US-53.1 Given un modérateur, When il avertit, suspend (1 à 90 jours) ou bannit un compte avec un motif, Then la sanction est historisée et notifiée.
- US-53.2 Given un compte suspendu, When il tente de publier, liker, commenter ou participer, Then c'est refusé (403) jusqu'à `ends_at` ; la consultation reste possible.
- US-53.3 Given un compte banni, When il se connecte ou envoie une requête, Then l'accès est refusé et ses sessions révoquées ; ses captures sont masquées.
- US-53.4 Given un bannissement, When il est décidé, Then seul un admin peut le prononcer ou le lever.
- US-53.5 Given une empreinte présente dans `banned_identities`, When quelqu'un s'inscrit avec cet email ou ce compte OAuth, Then l'inscription est refusée avec le message neutre habituel et l'événement est journalisé.
- Tests : U, I, E.

### US-54 [MVP] Versions du jeu
- US-54.1 Given un admin, When il crée, renomme (EN/FR), ordonne ou archive une version, Then la navigation reflète le changement.
- US-54.2 Given une version contenant des captures, When l'admin tente de la supprimer, Then seule l'archivage est possible.
- Tests : U, I, E.

### US-55 [MVP] Rôles
- US-55.1 Given un admin, When il promeut un membre modérateur ou le rétrograde, Then le rôle change et l'action est journalisée (US-58).
- US-55.2 Given un compte modérateur ou admin, When il se connecte (mot de passe ou OAuth), Then un code TOTP ou un code de secours est exigé avant tout accès à `/admin` ; un staff sans TOTP configuré est conduit à l'activer (10 codes de secours affichés une seule fois).
- US-55.5 Given un staff qui a perdu son TOTP et ses codes, When un autre admin réinitialise sa double authentification (ou Adrien via `pnpm admin:reset-mfa`), Then ses sessions sont révoquées, l'action est journalisée et il doit reconfigurer le TOTP à la connexion suivante.
- US-55.3 Given le dernier admin, When il tente de se rétrograder, Then c'est refusé.
- US-55.4 Given une base sans admin, When Adrien exécute `pnpm admin:promote --email <email>` avec l'accès direct à la base de production, Then le compte devient admin, l'action est journalisée, et la commande refuse de s'exécuter si un admin existe déjà (sauf `--force` confirmé).
- Tests : U, I, E.

### US-56 [MVP] Réglages du site
- US-56.1 Given un admin, When il modifie dans `/admin/settings` les seuils de qualité, de modération, d'affichage (US-70), le hero ou l'« Editor's pick », Then ils s'appliquent sans redéploiement (cache de 60 s maximum).
- US-56.2 Given une valeur invalide (seuils non croissants, hero de luminance > 0,6), When il enregistre, Then c'est refusé avec le motif.
- US-56.3 Given les flags de fonctionnalités (`features.contests`, `features.follows`, `features.collections`, `features.leaderboard`, `features.ads`, `features.donations`, `features.readonly`, `features.inviteOnly`), When un flag est désactivé, Then les entrées de menu et API correspondantes sont masquées ou répondent 404 ; `features.readonly` bloque toutes les mutations (503) sauf l'admin.
- US-56.4 Given le mode bêta sur invitation activé (`features.inviteOnly`), When un visiteur sans invitation valide s'inscrit, Then l'inscription est refusée avec un formulaire de liste d'attente (même message, pas d'énumération).
- US-56.5 Given un admin, When il invite un email depuis `/admin/invites` ou promeut une entrée de la liste d'attente, Then un lien d'inscription à usage unique valable 14 jours est envoyé ; l'inscription par ce lien (email ou OAuth) passe le mode invitation.
- Tests : U, I, E.

### US-57 [MVP] Dictionnaire des zones
- US-57.1 Given des zones saisies librement, When un admin ouvre la file « zones to review », Then il peut les fusionner avec une zone existante (alias ajouté, captures rattachées) ou les créer (noms EN/FR).
- US-57.2 Given le seed `docs/seed/zones.csv`, When la base est initialisée, Then toutes les zones et alias sont importés.
- Tests : U, I.

### US-58 [MVP] Journal d'audit
- US-58.1 Given une action de modérateur ou d'admin (décision, sanction, rôle, réglage, concours), When elle est effectuée, Then une entrée `audit_log` (acteur, action, cible, avant/après, date) est écrite, non modifiable via l'application.
- US-58.2 Given un admin, When il ouvre `/admin/audit`, Then il peut filtrer par acteur, action et période.
- Tests : I.

---

## E-PLATFORM — Transverse

### US-60 [MVP] Signaler un bug
- US-60.1 Given le formulaire, When je l'envoie, Then une issue GitHub est créée (labels `bug-report`, `needs-triage`) et je vois une confirmation avec une référence.
- US-60.2 Given un visiteur, When il ouvre le formulaire, Then seule la catégorie « I can't sign in » est disponible.
- US-60.3 Given 3 rapports dans l'heure, When j'en envoie un 4e, Then refus avec le délai d'attente.
- US-60.4 Given le champ piège rempli ou un envoi en moins de 3 s, When le formulaire est soumis, Then une confirmation neutre s'affiche mais rien n'est créé.
- US-60.5 Given un texte identique (normalisé) à un rapport des 7 derniers jours, When je l'envoie, Then l'issue existante reçoit un « +1 » au lieu d'une nouvelle issue.
- US-60.6 Given 30 issues créées dans l'heure, When un nouveau rapport arrive, Then il reste `held` et l'admin reçoit une alerte.
- US-60.7 Given un texte contenant « @someone » ou du Markdown, When l'issue est créée, Then la mention ne notifie personne et le Markdown s'affiche en texte brut.
- US-60.8 Given un compte avec 3 rapports marqués spam, When il ouvre le formulaire, Then le signalement lui est indisponible.
- Tests : U (anti-spam, échappement), I (GitHub simulé), E.

### US-61 [MVP] Consentement aux cookies
- US-61.1 Given une première visite, When la page se charge, Then aucun script PostHog ni publicitaire n'est chargé et le panneau propose Accept all / Reject all / Customise avec le même poids visuel.
- US-61.2 Given un refus, When je navigue, Then aucun cookie ni stockage non essentiel n'est déposé (vérifié par test) et le site fonctionne à l'identique.
- US-61.3 Given un choix enregistré, When 6 mois passent ou qu'une catégorie est ajoutée, Then le panneau est reproposé.
- US-61.4 Given le lien « Cookie settings » du pied de page, When je l'ouvre, Then je peux modifier mon choix ; un retrait supprime les cookies concernés.
- Tests : I, E.

### US-62 [MVP] Bilingue
- US-62.1 Given un navigateur dans une autre langue que le français, When j'arrive, Then le site s'affiche en anglais.
- US-62.2 Given un navigateur en français, When j'arrive sur `/`, Then je suis redirigé vers `/fr/` ; le sélecteur permet de changer et le choix est mémorisé (cookie essentiel).
- US-62.3 Given n'importe quel texte d'interface, When la CI s'exécute, Then une clé absente dans `en.json` ou `fr.json` fait échouer le build.
- US-62.4 Given les contenus administrés (versions, zones, concours), When la langue change, Then leur libellé EN ou FR s'affiche (repli sur l'anglais).
- Tests : U (complétude des clés), E.

### US-63 [MVP] Installer l'application
- US-63.1 Given Chrome Android ou desktop, When le manifest est analysé, Then l'application est installable (Lighthouse « installable ») avec nom, icônes maskable, couleurs, captures d'écran et raccourcis Upload, Search, Notifications (Leaderboard ajouté avec US-22).
- US-63.2 Given ma première visite, When la page se charge, Then aucune invitation à installer n'apparaît.
- US-63.3 Given ma 2e visite ou ma première capture publiée, When `beforeinstallprompt` est disponible, Then un bandeau discret propose l'installation ; fermé, il ne revient pas avant 30 jours.
- US-63.4 Given Safari iOS, When je choisis « Install the app » dans le menu du profil, Then une feuille explique « Share → Add to Home Screen ».
- US-63.5 Given l'app installée sur iPhone, When je l'ouvre, Then elle s'affiche en plein écran sans chevauchement avec l'encoche ni la barre d'accueil.
- Tests : E.

### US-64 [MVP] Hors ligne et cache
- US-64.1 Given une PDP consultée en ligne, When je la rouvre hors ligne, Then la page et son image 1200 px s'affichent depuis le cache.
- US-64.2 Given une page jamais consultée, When je l'ouvre hors ligne, Then `/offline` s'affiche avec la liste des pages disponibles.
- US-64.3 Given que je suis hors ligne, When je regarde une capture, Then Like, Comment, Follow et Upload sont désactivés avec « You're offline » et un bandeau l'indique.
- US-64.4 Given que je me déconnecte, When la déconnexion aboutit, Then les caches `pages` et `api-public` sont vidés.
- US-64.5 Given un original ou une variante 2400 px, When je l'ouvre, Then il n'est jamais stocké par le service worker.
- US-64.6 Given plus de 300 images en cache, When une nouvelle est ajoutée, Then la plus ancienne est supprimée.
- Tests : E (Playwright avec service worker et mode hors ligne).

### US-65 [MVP] Mise à jour de l'application
- US-65.1 Given une nouvelle version déployée, When le nouveau service worker est prêt, Then un toast « A new version is available · Reload » s'affiche.
- US-65.2 Given un upload en cours, When une nouvelle version est prête, Then le toast attend la fin de l'upload.
- US-65.3 Given que je clique Reload, When la page se recharge, Then la nouvelle version est active et les anciens caches supprimés.
- Tests : E.

### US-66 [v1.x] Partager depuis la galerie du téléphone (Android)
- US-66.1 Given l'app installée sur Android, When je partage une image depuis ma galerie vers Legendary Shots, Then l'upload s'ouvre avec l'image préchargée.
- US-66.2 Given que je ne suis pas connecté, When je partage une image, Then je me connecte puis je retrouve l'upload avec l'image.
- Tests : E (émulation du POST share target).

### US-67 [MVP] Utilisation sur mobile
- US-67.1 Given un écran de moins de 768 px, When j'ouvre le site, Then la navigation principale est une barre d'onglets en bas avec Upload au centre (au MVP : Explore · Search · Upload · Notifications · Profile ; cf. 07-design) et la grille affiche 2 colonnes.
- US-67.2 Given une PDP sur mobile, When je glisse à gauche ou à droite, Then la capture suivante ou précédente s'affiche.
- US-67.3 Given un badge de qualité ou une infobulle d'objet, When je le touche, Then une bottom sheet affiche son contenu.
- US-67.4 Given les filtres de la PLP sur mobile, When je touche « Filters », Then ils s'ouvrent en bottom sheet plein écran.
- US-67.5 Given n'importe quel élément interactif, When je mesure sa zone tactile, Then elle fait au moins 44 × 44 px.
- US-67.6 Given une largeur de 360 px, When j'ouvre chaque page, Then aucun défilement horizontal n'apparaît.
- Tests : E (projets iPhone 14, Pixel 7, iPad).

### US-68 [MVP] Performance
- US-68.1 Given un mobile milieu de gamme en 4G simulée, When j'ouvre la home, la PLP ou la PDP, Then LCP < 2,5 s, CLS < 0,1 et INP < 200 ms.
- US-68.2 Given une pull request, When la CI s'exécute, Then Lighthouse CI échoue si Performance < 85, Accessibility < 95, Best practices < 95 ou si l'app n'est plus installable.
- US-68.3 Given une image de grille, When elle s'affiche, Then elle vient d'un `srcset` WebP à la bonne largeur (variantes stockées, ADR-012), avec dimensions réservées.
- US-68.4 Given une API publique de lecture, When elle est appelée, Then p95 < 300 ms mesuré sur la preview.
- Tests : E (Lighthouse CI), I (temps de réponse).

### US-69 [MVP] Erreurs et pages d'état
- US-69.1 Given une URL inexistante, When je l'ouvre, Then une page 404 aux couleurs du site propose recherche et retour à l'accueil, avec le statut HTTP 404.
- US-69.2 Given une erreur serveur, When elle survient, Then une page 500 s'affiche sans détail technique, l'erreur est envoyée au suivi d'erreurs avec un identifiant de corrélation affiché à l'utilisateur.
- US-69.3 Given une erreur d'API, When le client la reçoit, Then le message affiché est traduit et l'action peut être retentée (pas de perte de saisie dans les formulaires).
- Tests : I, E.

### US-75 [MVP] Accessibilité
- US-75.1 Given le clavier seul, When je parcours home, PLP, PDP, upload, connexion et réglages, Then tous les éléments interactifs sont atteignables dans un ordre logique avec un focus visible (contraste ≥ 3:1) ; un lien « Skip to content » est le premier élément.
- US-75.2 Given une modale, une bottom sheet ou la visionneuse plein écran, When elle est ouverte, Then le focus y est piégé, `Échap` la ferme et le focus revient à l'élément déclencheur.
- US-75.3 Given une capture, When un lecteur d'écran la lit, Then son texte alternatif est « {titre} — {zone}, captured by {auteur} » (ou le texte alternatif saisi par l'auteur, 150 caractères max) ; les icônes décoratives sont masquées (`aria-hidden`).
- US-75.4 Given `prefers-reduced-motion: reduce`, When les animations s'exécutent (halos, transitions, carrousels), Then elles sont désactivées ou réduites à un fondu.
- US-75.5 Given un badge de qualité, When il est perçu sans couleur, Then son nom (Poor, Rare…) est toujours présent en texte.
- US-75.6 Given chaque page, When le test axe-core s'exécute, Then aucune violation « serious » ni « critical ».
- Tests : composants (focus trap), E (clavier, axe).

### US-72 [MVP] Mesure d'audience produit
- US-72.1 Given le consentement analytics accordé, When j'effectue une action listée (`03-architecture.md` § Analytics), Then l'événement est envoyé à PostHog EU avec un identifiant pseudonyme, sans email ni pseudo.
- US-72.2 Given le consentement refusé, When j'agis, Then aucun événement n'est envoyé (vérifié par test réseau).
- Tests : U, E.

### US-73 [v1.x] Publicité
- US-73.1 Given `features.ads` activé, When une grille s'affiche, Then un emplacement apparaît toutes les 24 captures et une bannière en pied de page, jamais dans le hero ni dans la PDP au-dessus de l'image.
- US-73.2 Given un refus du consentement publicitaire, When les annonces s'affichent, Then elles sont non personnalisées.
- US-73.3 Given un emplacement non rempli, When la régie ne répond pas, Then l'emplacement se replie sans décalage de mise en page (CLS).
- US-73.4 Given une régie qui exige une plateforme de consentement certifiée IAB TCF v2.2 (cas de Google AdSense dans l'EEE, à vérifier selon la régie retenue en Q2), When la publicité est activée, Then le panneau de consentement maison est remplacé ou complété par cette plateforme, sans dégrader US-61.
- US-73.5 Given la page photo, When elle s'affiche, Then aucune annonce n'apparaît au-dessus de l'image ; un emplacement latéral, sous les infobulles, n'apparaît que sur grand écran. Given la home ou une PLP, When une annonce est affichée, Then le libellé « Advertisement » est visible au-dessus d'elle.
- US-73.6 Given une annonce, When elle est rendue, Then sa hauteur est réservée à l'avance (CLS) ; les emplacements du hero, des bandeaux de quête, des écrans de connexion, d'upload et de réglages ne reçoivent jamais d'annonce.
- Tests : E.

### US-74 [MVP] Pages légales
- US-74.1 Given le pied de page, When je clique Legal notice, Terms, Privacy ou Cookie settings, Then la page correspondante s'affiche dans ma langue (repli anglais) avec sa date de mise à jour.
- US-74.2 [v1.x, T-70] Given une modification significative des Terms, When un admin publie la nouvelle version avec une date d'effet à J+15 minimum, Then les membres sont notifiés (in-app et par email) et la page affiche la version à venir.
- US-74.3 [v1.x, T-70] Given la date d'effet passée et un membre qui a accepté une version antérieure, When il se connecte ou publie, Then un écran lui demande d'accepter la nouvelle version (`terms_version` mis à jour) ; il peut aussi supprimer son compte depuis cet écran.
- Tests : E.

---

## E-QUALITY — Qualité et démarrage

### US-70 [MVP] Aucun bloc vide
- US-70.1 Given un auteur avec une seule autre capture, When j'ouvre sa PDP, Then le bloc « More from » est complété par « Similar captures » (même zone puis même version), sans emplacement vide.
- US-70.2 Given un auteur sans autre capture et aucune capture de la même zone, When j'ouvre la PDP, Then le bloc devient « Latest in {version} », ou disparaît s'il n'y a rien.
- US-70.3 [v1.x, T-63] Given moins de 10 captures publiées cette semaine, When j'ouvre le classement (si activé), Then la période passe au mois puis à « All time », ou une jauge de progression s'affiche avec un CTA Upload.
- US-70.4 Given aucune capture avec 10 likes sur 7 jours, When j'ouvre la home, Then « Capture of the week » montre la plus likée sur 30 jours, puis de tous les temps, puis l'« Editor's pick ».
- US-70.5 Given une version sans capture, When j'ouvre sa PLP, Then « Be the first to capture {version} » s'affiche avec un CTA Upload.
- US-70.6 Given une capture avec 4 likes et 2 téléchargements, When je la vois, Then aucun compteur sous 10 n'est affiché ; badge « New » si elle a moins de 7 jours.
- Tests : U (règles de repli), I, E.

### US-71 [MVP] Comprendre la qualité
- US-71.1 Given la PLP, When je clique « ? » à côté de « Minimum quality », Then une infobulle liste les 5 niveaux et leurs seuils actuels (lus dans `site_settings`) avec un lien vers `/help/quality`.
- US-71.2 Given un badge de qualité, When je le survole ou le touche, Then je vois le niveau, son seuil et le nombre de likes manquants pour le suivant.
- US-71.3 Given ma première capture publiée, When elle passe en ligne, Then je reçois une seule notification qui explique le système de qualité.
- US-71.4 Given une de mes captures qui atteint un palier, When le like décisif arrive, Then je reçois une notification « reached {quality} » (une seule fois par palier, même si des likes sont retirés puis remis).
- US-71.5 Given un admin qui modifie les seuils, When je rouvre l'infobulle, Then les nouvelles valeurs s'affichent sans redéploiement.
- Tests : U (calcul de qualité), I, E.

## E-SUPPORT — Soutien du site [v1.1, derrière `features.donations`]

Dons ponctuels uniquement pour l'instant. Aucune récurrence. Aucune contrepartie qui influence le classement, les concours ou la modération. Montant minimum : 2 € (décidé le 18/11/2026, à valider sur la grille du prestataire, Q21).

### US-76 [v1.1] Faire un don ponctuel
- US-76.1 Given `features.donations` activé, When je clique « Support the site » (footer, menu du profil), Then la page `/support` s'affiche avec les montants 2 €, 5 € et 10 € et un champ libre à partir de 2 €.
- US-76.2 Given un montant inférieur à 2 € saisi, When je valide, Then le formulaire refuse la saisie avec un message explicite, sans appel au prestataire.
- US-76.3 Given un don, When je le fais, Then aucun compte n'est requis et aucune donnée bancaire ne transite par le site (page hébergée ou fenêtre du prestataire).
- US-76.4 Given un paiement réussi, When le prestataire renvoie l'utilisateur, Then une page de remerciement s'affiche ; si le paiement est asynchrone, un état « en attente » est affiché jusqu'à confirmation (webhook signé, idempotent).
- US-76.5 Given un paiement annulé, When je reviens sur le site, Then une page neutre propose de revenir à `/support`, sans message d'erreur technique.
- US-76.6 Given `features.donations` désactivé, When j'ouvre `/support` ou un webhook de don, Then 404 ; la table `donations` existe mais reste vide.
- Tests : U (règle du minimum, idempotence du webhook), I (table `donations`, signature), E (parcours de don avec le prestataire en mode test).

### US-77 [v1.1] Badge « Supporter » et reçu
- US-77.1 Given un don réussi, When je coche « Afficher le badge Supporter » sur la page de don, Then un badge s'affiche sur mon profil ; sans case cochée, aucun badge.
- US-77.2 Given un badge Supporter, When il est affiché, Then il ne modifie ni le classement, ni les concours, ni la modération, ni la visibilité des captures.
- US-77.3 Given un don réussi, When le paiement est confirmé, Then un reçu est envoyé par email avec la mention « don à un service en ligne, non déductible » tant que Q20 n'est pas tranché.
- Tests : U (règle d'affichage du badge), I (envoi du reçu), E.

### US-78 [v1.1] Historique des dons
- US-78.1 Given un utilisateur connecté qui a donné, When j'ouvre `/settings`, Then je vois mes dons (date, montant, reçu téléchargeable) ; le montant n'est jamais affiché publiquement.
- US-78.2 Given un utilisateur qui n'a jamais donné, When j'ouvre `/settings`, Then la section « Historique des dons » est masquée.
- Tests : U, E.

---

## E-SECRETS — Secrets et easter eggs

Règles communes : contenu maison (aucun nom, texte, son ni image de Blizzard) ; purement cosmétique (aucun effet sur la qualité, le classement, les concours ni la modération) ; textes EN et FR ; `prefers-reduced-motion` respecté (aucune animation) ; aucun son, ou son activable et coupé par défaut ; messages annoncés aux lecteurs d'écran (`aria-live="polite"`) ; jamais actif dans un champ de saisie ; aucune touche bloquée (les flèches gardent leur rôle de navigation, T-31b).

### US-79 [MVP] Petites surprises
- US-79.1 Given la page 404, When elle s'affiche, Then le titre est « You have wandered into an uncharted zone » (FR : « Vous vous êtes aventuré en zone inexplorée ») et le bouton principal « Use Hearthstone » (FR : « Utiliser la pierre de foyer ») ramène à l'accueil, en plus de l'identifiant de corrélation existant (US-69).
- US-79.2 Given la console du navigateur ouverte sur n'importe quelle page, When le site se charge, Then un logo ASCII et la ligne « Looking for guild? Report bugs: {lien vers /feedback} » s'affichent une seule fois par session, en production comme en preview.
- Tests : E (404), U (message console émis une fois).

### US-80 [v1.x] Easter eggs (`features.easterEggs`)
- US-80.1 Given la séquence ↑ ↑ ↓ ↓ ← → ← → B A tapée hors d'un champ de saisie, When elle est complète, Then une fenêtre « Need / Greed / Pass » s'ouvre sur la Capture of the week ; « Need » affiche « You won: [Legendary Shot] » et toutes les miniatures visibles prennent la bordure Legendary pendant 30 s (sans animation si `prefers-reduced-motion`).
- US-80.2 Given un utilisateur connecté qui choisit « Need » pour la première fois, When la fenêtre se ferme, Then le badge cosmétique « Ninja Looter » est ajouté à son profil (une seule fois).
- US-80.3 Given la recherche, When je tape `/dance`, `/afk`, `mrglglgl` ou `leeroy`, Then respectivement : le logo danse 5 s ; l'onglet devient « <AFK> Legendary Shots » jusqu'à la prochaine action ; le message « aucun résultat » est sous-titré « Mrgl mrgl, no captures found » ; le bouton devient « LEEEROY » et ouvre une capture au hasard.
- US-80.4 Given 10 clics sur le logo en moins de 5 s, When le 10e arrive, Then une bulle « Stop poking me! » apparaît 3 s.
- US-80.5 Given 5 minutes sans interaction, When l'onglet est visible, Then son titre est préfixé « <AFK> », retiré à la première interaction.
- US-80.6 Given le 23 novembre (anniversaire de WoW, fuseau Europe/Paris) ou le 31 octobre, When j'ouvre le site, Then le logo porte un accessoire de saison ; le 23 novembre, un bandeau de quête « Happy birthday, Azeroth » s'affiche sur l'accueil.
- US-80.7 Given `features.easterEggs` désactivé, When je tape la séquence ou une commande, Then rien ne se passe.
- Tests : U (détection de séquence, ignorée dans les champs, flèches non bloquées), E (US-80.1, US-80.3).

### US-81 [v1.x] Quête secrète « The Lost Shot » (`features.secrets`)
- US-81.1 Given une quête active, When un utilisateur découvre le point de départ (indice public : message console ou détail du footer), Then il peut soumettre la première réponse ; chaque bonne réponse révèle l'indice suivant, **renvoyé par le serveur** (aucun indice ni réponse dans le bundle JavaScript).
- US-81.2 Given une réponse soumise, When le serveur la reçoit, Then elle est normalisée (NFKC, minuscules, espaces réduits) et comparée au HMAC-SHA256 stocké pour l'étape courante de l'utilisateur, avec le contexte exigé par l'étape (ex. identifiant de la capture sur laquelle le Konami code doit être tapé) ; une mauvaise réponse renvoie `{ ok: false }` sans indiquer ce qui est faux ni le nombre d'étapes.
- US-81.3 Given un utilisateur, When il dépasse 10 essais par minute ou 100 par jour sur une quête, Then 429 avec `retry-after` (`rate_limit_counters`).
- US-81.4 Given la dernière étape réussie, When elle est validée, Then le badge et le titre de la quête (ex. « Keeper of the Lost Shot ») sont attribués, affichables sur le profil si l'utilisateur le souhaite ; les 10 premiers sont inscrits au « Hall of Seekers » de la quête (pseudo et date), avec possibilité de s'en retirer.
- US-81.5 Given un visiteur non connecté, When il trouve une étape, Then l'indice s'affiche avec « Sign in to keep your progress » ; la progression n'est enregistrée qu'une fois connecté.
- US-81.6 Given un admin, When il gère les quêtes dans `/admin/secrets`, Then il crée une quête (titre EN/FR, saison, dates), ses étapes (ordre, déclencheur, contexte, réponse saisie une fois puis seulement stockée en HMAC, indice EN/FR), l'active ou la clôt ; chaque action est auditée ; une quête close reste visible avec son Hall of Seekers.
- US-81.7 Given `features.secrets` désactivé ou aucune quête active, When un essai est soumis, Then 404.
- Tests : U (normalisation, ordre des étapes, attribution unique), I (HMAC, limites, contexte exigé, aucune fuite d'indice d'étape suivante), E (parcours complet d'une quête de test à 3 étapes).
