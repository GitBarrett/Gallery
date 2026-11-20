# 02 — Spécifications fonctionnelles

Priorité : **[MVP]** = livrable de la v1. Le reste suit en v1.x, derrière des flags (`site_settings.features.*`).
Les critères d'acceptation font foi dans `04-user-stories.md` ; la sécurité dans `08-securite.md`.

## 1. Comptes [MVP]
- Connexion : Battle.net (OAuth, hôte global `oauth.battle.net`, sans choix de région), Google (OAuth), email + mot de passe.
- Email : vérification obligatoire avant publication. Mot de passe oublié : lien unique valable 1 h.
- Mot de passe : 10 caractères minimum, hachage Argon2id (ou scrypt si Argon2 indisponible sur Workers, voir ADR).
- Pseudo : unique, 3–24 caractères `[a-zA-Z0-9_-]`, choisi au premier login.
- Profil public : avatar, bio (300 car.), photos, collections publiques, stats (photos, likes reçus, abonnés).
- Liaison de comptes : un email OAuth identique à un compte existant → liaison après connexion au compte existant (jamais de fusion automatique).
- [MVP] Réglages du compte `/settings` : avatar, bio, langue, email (avec confirmation), mot de passe, comptes liés, préférences de notification.
- [MVP] Suppression du compte en libre-service, effective à J+30 (annulable) ; [v1.x] export automatisé (avant : sur demande par email).
- [MVP] Âge minimum 15 ans et acceptation des Terms à l'inscription (email ou OAuth), version acceptée enregistrée.
- [MVP] Email vérifié requis pour publier, commenter, participer ; pas pour liker ou suivre.
- [MVP] Avatar soumis à la modération automatique ; bio filtrée.
- [MVP] Un compte banni ne peut pas se réinscrire pendant 1 an (empreinte HMAC de l'email et des identifiants OAuth).
- [MVP] Double authentification TOTP obligatoire pour les modérateurs et admins, quel que soit le mode de connexion, avec 10 codes de secours.
- [MVP] Mode bêta sur invitation (`features.inviteOnly`) : inscription sur invitation nominative, sinon liste d'attente ; désactivé à l'ouverture publique.
- [MVP] Changement des Terms : publication avec date d'effet à J+15 minimum, notification in-app et email, réacceptation demandée après la date d'effet.

## 2. Publication [MVP]
- Formats : JPEG, PNG, WebP ; TGA accepté dans le formulaire et converti en PNG sans perte dans le navigateur avant envoi (ADR-011).
- Limites : 20 Mo (limite d'entrée du binding Images), 7680 px max sur le grand côté et 33,2 Mpx (8K 7680 × 4320, captures DSR/VSR), 640 px min. Formats réels visés : 1080p, 1440p, ultrawide 3440×1440 et 5120×1440, 4K, 5K2K, 8K.
- Fichier trop lourd (TGA converti ou PNG > 20 Mo) : conversion dans le navigateur en WebP sans perte, puis, si besoin, JPEG qualité 95 en 4:4:4 avec avertissement ; jamais de WebP avec perte pour un original.
- Affichage : variantes WebP 400/800/1200/2400 et JPEG 1200 générées une fois au traitement (ADR-012).
- Champs : titre (obligatoire, 100 car.), description (1000 car.), version du jeu (obligatoire, **champ unique** issu de la liste administrable `game_versions`, qui sert aussi de catégorie ; pas de champ « extension » séparé), tags (10 max), métadonnées de prise de vue facultatives (zone choisie dans le dictionnaire des zones, heure en jeu, réglages graphiques, personnage, classe, race).
- Métadonnées (EXIF, XMP, IPTC, texte PNG) supprimées sans réencodage. Type vérifié sur les octets, pas sur l'extension.
- Statuts : `processing`, `failed`, `pending_review`, `published`, `rejected`, `hidden`. L'auteur voit ses captures non publiées dans « My captures » avec leur statut (aperçu privé).
- Quota anti-abus : 20 uploads / utilisateur / 24 h.

## 3. Découverte
- [MVP] Catégories par version du jeu, administrables (seed : WoW Forever, Retail, Classic Era, Classic progression, Other).
- [MVP] Grille masonry, défilement infini (pagination par curseur), vue détaillée plein écran avec précédent/suivant.
- [MVP] Dictionnaire des zones : chaque zone a un nom EN, un nom FR et des alias (ex. Stormwind City / Hurlevent / SW). Affichage dans la langue du visiteur ; recherche sur tous les noms et alias. Seed : `docs/seed/zones.csv` (≈ 50 zones, à compléter et faire relire), administrable. À l'upload, la zone se choisit par autocomplétion ; une zone absente peut être saisie librement et part en file « zones à valider » côté admin.
- [MVP] Recherche texte + tags, tolérante aux fautes, autocomplétion des zones et tags, filtres version, tri récent / populaire (Postgres full-text + pg_trgm, cf. ADR-007).
- [v1.x] Classement : top 50 sur 7 jours, 30 jours ou depuis toujours (US-22).
- [v1.x] Fil « Abonnements ».
- [MVP] Home : hero choisi par l'admin, « Capture of the week », bandeau de quête si concours ouvert.
- [MVP] SEO : rendu serveur, Open Graph, canonique, `hreflang`, sitemap, robots (US-25).

## 4. Interactions
- [MVP] Like : un par utilisateur et par photo, réversible.
- [MVP] Commentaires à plat (pas de réponses imbriquées) : 1000 car., texte brut, filtre d'insultes FR/EN, édition 15 min, suppression par l'auteur du commentaire ou de la capture.
- [MVP] Partage : copie de lien, X, Facebook, Reddit, Discord ; balises Open Graph / Twitter Card avec image.
- [MVP] Téléchargement de l'original : utilisateur connecté, compteur.
- [v1.x] Suivre un photographe.
- [v1.x] Favoris + collections (publiques/privées).
- [MVP] Notifications in-app (like groupé, commentaire, abonné, modération, palier de qualité, concours), préférences par type ; [v1.x] récap email hebdomadaire.

## 5. Concours (v1.x) — epic E-CONTEST

### 5.1 Cycle de vie
`draft` → `scheduled` → `open` → `judging` (48 h) → `closed` ; `cancelled` possible avant `closed`.
- `open` : participations et votes (likes) comptés.
- `judging` : participations et votes gelés ; les modérateurs traitent les signalements et disqualifications ; classement provisoire affiché « en vérification ».
- `closed` : résultats publiés, récompenses attribuées, notifications envoyées.
- Transitions automatiques par Cloudflare Cron Trigger (toutes les 5 min) ; heures en UTC, affichées dans le fuseau du visiteur.
- Plusieurs concours peuvent être ouverts en même temps ; une photo ne peut concourir que dans un seul.

### 5.2 Création (admin)
Champs : slug, titre et description EN/FR, thème, bannière (photo de la galerie, luminance ≤ 0,6), début, fin (durée 7 à 30 jours), critères d'éligibilité (version du jeu facultative, liste de zones facultative, tag obligatoire facultatif), récompenses (texte), seuil minimal de participations (défaut 10), option « vote à l'aveugle » (likes masqués pendant `open`, défaut désactivée).
Une fois `open`, seuls la description, les récompenses et la date de fin (allongement uniquement) sont modifiables.

### 5.3 Éligibilité
- **Participant** : compte vérifié, créé depuis ≥ 7 jours, non suspendu ni banni.
- **Photo** : de l'auteur, statut `published`, publiée entre le début et la fin du concours, conforme aux critères (version, zone, tag), pas déjà inscrite dans un autre concours.
- **1 participation active par utilisateur et par concours.** Retrait possible jusqu'à la fin ; remplacement = retrait + nouvelle participation (le score repart de la nouvelle photo).

### 5.4 Score et classement
- Score = likes reçus par la photo entre sa publication et la fin du concours.
- Ne comptent pas : les likes de comptes de moins de 7 jours, suspendus ou bannis, ni ceux retirés avant la fin. L'auto-like est déjà impossible partout.
- Classement recalculé toutes les 5 min pendant `open`, figé à l'entrée en `judging`.
- Égalité : la participation inscrite en premier gagne.

### 5.5 Anti-triche
- Alerte modérateur si > 30 % des likes d'une participation viennent de comptes créés après le début du concours, ou si > 20 % viennent d'un même `ip_hash`.
- Disqualification par un modérateur, avec motif notifié et voie de recours (cf. Terms §5) ; une participation disqualifiée sort du classement et n'est pas remplaçable.
- 2 disqualifications pour triche = exclusion des concours pendant 90 jours.

### 5.6 Participation insuffisante
À la fin, si participations actives < seuil (défaut 10) : prolongation automatique de 7 jours, une seule fois. À la nouvelle fin, si < 3 participations : clôture sans podium, badge de participation attribué.

### 5.7 Résultats et récompenses
- Podium 1-2-3 ; badges sur le profil : « Champion », « Silver », « Bronze » + badge de participation pour tous.
- Bandeau « Contest winner » sur la photo gagnante.
- La photo gagnante devient le hero de la home pendant 7 jours (si luminance ≤ 0,6, sinon mise en avant « Capture of the week »).
- Les récompenses matérielles éventuelles sont hors périmètre technique (texte libre).

### 5.8 Notifications
Ouverture d'un concours (utilisateurs ayant activé « Contests »), J-1 avant la fin (participants), prolongation, disqualification (avec motif), résultats (participants).

## 6. Modération [MVP]
- Auto à l'upload (Sightengine, modèles `nudity-2.1`, `gore-2.0`, `offensive-2.0`) :
  - score max ≥ 0,85 → `rejected`
  - 0,5 ≤ score < 0,85 → `pending_review`
  - < 0,5 → `published`
  - Seuils en configuration, pas en dur.
- Signalements : motif + commentaire ; 3 signalements distincts (réglable) de comptes vérifiés depuis plus de 7 jours et non sanctionnés → `hidden` ; les autres alimentent la file sans masquer.
- Admin : file de modération, historique des décisions, sanctions [MVP] (avertissement, suspension datée, bannissement — ce dernier réservé aux admins), recours traité par un autre modérateur, gestion des versions et des zones, réglages du site, journal d'audit.
- Rôles : `user`, `moderator`, `admin` ; promotion par un admin uniquement.

## 7. Transverse
- [MVP] Signalement de bug : formulaire → table `bug_reports` → Queue → issue GitHub (label `bug-report`, `needs-triage`), capture facultative, user agent, URL, identifiant utilisateur. Garde-fous anti-spam :
  - **Accès** : réservé aux comptes connectés et vérifiés ; seule la catégorie « Je ne peux pas me connecter » est ouverte aux visiteurs, avec des limites plus strictes.
  - **Anti-bot** : Turnstile obligatoire, champ piège invisible (honeypot), envoi refusé s'il arrive moins de 3 s après l'affichage du formulaire.
  - **Limites de débit** : connecté 3 / heure et 10 / jour ; visiteur 1 / heure et 3 / jour par IP ; comptes de moins de 24 h : 1 / jour.
  - **Contenu** : 20 à 5 000 caractères, 2 liens maximum, filtre d'insultes, capture image seule ≤ 5 Mo (réencodée, EXIF retirés, stockée sur R2, jamais envoyée chez GitHub).
  - **Doublons** : empreinte du texte normalisé ; un doublon sur 7 jours incrémente un compteur « +1 » sur l'issue existante au lieu d'en créer une.
  - **Disjoncteur global** : au-delà de 30 issues / heure, plus aucune issue n'est créée ; les rapports restent en base et l'admin est alerté par email.
  - **Modération** : l'admin marque un rapport « spam » depuis le back-office ; 3 rapports spam = signalement de bug désactivé pour le compte, et l'issue GitHub est fermée.
  - **Sécurité GitHub** : dépôt privé dédié, GitHub App limitée aux issues de ce dépôt, contenu échappé (Markdown neutralisé, `@` mentions désactivées, aucun lien cliquable), aucune donnée personnelle (pas d'email, seulement l'id utilisateur).
- [MVP] Consentement RGPD : PostHog et publicité chargés uniquement après acceptation, choix modifiable.
- [MVP] Bilingue : anglais par défaut, français si navigateur en français, sélecteur. URLs : `/` (en), `/fr/...`.
- [MVP] PWA installable (manifest complet, icônes maskable, raccourcis), invitation à l'installation discrète, hors ligne limité (shell + pages et images récemment vues), mises à jour proposées à l'utilisateur. Détail technique : `03-architecture.md` § PWA.
- [MVP] Mobile d'abord : navigation par barre d'onglets en bas sous 768 px, PDP au swipe, infobulles en bottom sheet. Détail : `07-design.md` § Responsive.
- v1.x : partage d'une image depuis la galerie du téléphone vers l'upload (Web Share Target, Android) ; notifications push web (iOS 16.4+ uniquement une fois l'app installée).
- Publicité (v1.x) : emplacements bannière + intercalé dans la grille, régie à choisir.
- Pied de page : mention de non-affiliation Blizzard, mentions légales, CGU, confidentialité.
- [MVP] Accessibilité WCAG 2.1 AA (US-75) : clavier, focus, lecteurs d'écran, mouvement réduit.
- [MVP] Thème sombre uniquement.
