# 09 — Questions ouvertes

| # | Question | Option par défaut (simple, réversible) | Statut |
|---|---|---|---|
| Q1 | Direction de design | A — Nuit d'Azeroth + kit d'identité WoW | Tranché — Adrien, 16/11/2026 |
| Q2 | Régie publicitaire | Google AdSense au lancement ; attention : Google exige une plateforme de consentement certifiée IAB TCF v2.2 pour diffuser dans l'EEE (à vérifier au moment du choix), ce qui remplacerait le panneau maison (US-73.4) | Ouvert (v1.x) |
| Q3 | Nom du site et domaine | **Legendary Shots** (tranché 17/11/2026, Adrien). Domaine à réserver : legendaryshots.com / .gg / .app (disponibilité non vérifiée) | Tranché — domaine à acheter |
| Q4 | Convertir les PNG en WebP sans perte ? | Non : originaux conservés sans réencodage (ADR-011) | Tranché par ADR-011 |
| Q5 | Argon2id disponible sur Workers ? | Sinon scrypt via `@noble/hashes` | Tranché par T-00d (20/11/2026) : Argon2id via `@noble/hashes`, ADR-015 |
| Q6 | Liste des versions du jeu au lancement (champ unique, administrable) | WoW Forever, Retail, Classic Era, Classic progression, Other | À valider |
| Q7 | Validation juridique (marque Blizzard + pub) ; usage des icônes officielles via l'API Battle.net (Game Data, media) sur un site financé par la pub | Set d'icônes maison ; jamais de récupération depuis des sites tiers (Wowhead…) | Ouvert |
| Q8 | Liste d'insultes FR/EN | Liste open source type `leo-profanity` + ajouts | À valider |
| Q9 | Seed des zones : relecture des noms FR et complétion (extensions récentes, WoW Forever) | `docs/seed/zones.csv`, ≈ 50 zones classiques | À relire — Adrien |
| Q10 | Dépôt GitHub des bug reports | Dépôt privé dédié (ex. `legendary-shots-feedback`), GitHub App limitée aux issues | À créer — Adrien |
| Q11 | Textes légaux (`docs/legal/`) : éditeur (personne ou société), adresses de contact, âge minimum, régie pub, relecture juridique ; registre des traitements et DPA | Brouillons EN avec champs [À COMPLÉTER] | À compléter et faire relire — Adrien |
| Q12 | Concours : MVP ou v1.x ? Vote à l'aveugle par défaut ? Récompenses matérielles ? | v1.x ; vote visible ; badges + hero de la home uniquement (des lots de valeur imposeraient un règlement de jeu-concours conforme au droit français) | À valider — Adrien |
| Q13 | Périmètre MVP ajusté lors de la revue du 17/11/2026 : notifications in-app, sanctions, réglages du compte, suppression de compte en libre-service et double authentification staff passent en MVP ; export de données automatisé reste v1.x (manuel avant) | Appliqué dans les specs | À valider — Adrien |
| Q14 | Outil de suivi d'erreurs | Sentry (offre gratuite, `@sentry/cloudflare`, sans données personnelles) | À valider |
| Q15 | Postgres de test en CI | Conteneur `postgres:16` dans GitHub Actions (rapide, gratuit) ; branche Neon pour les previews | À valider |
| Q16 | Plan de zone Cloudflare : Free ou Pro (20 $/mois en annuel) ? Le Free n'a ni règles gérées complètes, ni OWASP, et une seule règle de limitation sur 10 s | Free pendant la bêta ; Pro à l'ouverture publique si le budget le permet, au plus tard à 20k MAU ou au premier incident | À valider — Adrien |
| Q17 | Surcoût FinOps révélé par la revue du 17/11/2026 (≈ 85 $/mois à 5k MAU au lieu de 40, ≈ 1 070 $ à 100k au lieu de 860) : Resend Pro et Neon Launch obligatoires dès l'ouverture, variantes stockées (ADR-012) | Accepter ; revoir à 10k MAU avec les vrais chiffres | À valider — Adrien |
| Q18 | Original téléchargé au format WebP sans perte (fichier > 20 Mo converti) : utilisable comme fond d'écran partout ? | Proposer en plus « Download as PNG », converti sans perte dans le navigateur | À vérifier en T-34 |
| Q19 | Lancer la phase de prototypes T-00 avant toute infrastructure ? | Oui : T-00a à T-00h avant T-02 et T-03 | Tranché — Adrien, 20/11/2026 : prototypes techniques d'abord |
| Q20 | Dons : statut juridique (entreprise ou association loi 1901) et fiscalité (dons déductibles ou non) | Entreprise, reçu « don à un service en ligne, non déductible » ; à valider par un professionnel | À valider — Adrien et juriste |
| Q21 | Dons : le prestataire de paiement accepte-t-il le contenu du site (jeux vidéo) et quelle est sa grille tarifaire ? Minimum fixé à 2 € | Stripe ou équivalent, vérifié avant T-68 ; dons récurrents écartés | Ouvert |
