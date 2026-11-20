# Pages légales — brouillons

Brouillons rédigés pour un site édité en France, hébergé chez des prestataires US et UE, financé par la publicité et hébergeant du contenu publié par ses utilisateurs (RGPD, loi pour la confiance dans l'économie numérique, Digital Services Act, lignes directrices cookies de la CNIL).

**Ce ne sont pas des textes validés juridiquement.** Les faire relire avant la mise en production (cf. Q7). Les champs `[ENTRE CROCHETS]` sont à compléter.

| Fichier | Route | Contenu |
|---|---|---|
| legal-notice.md | `/legal` | Mentions légales : éditeur, directeur de publication, hébergeurs, contact, signalement de contenu |
| terms.md | `/terms` | Conditions d'utilisation : comptes, contenu publié, licence, règles, modération, sanctions, recours |
| privacy.md | `/privacy` | Politique de confidentialité : données, finalités, bases légales, durées, sous-traitants, transferts, droits |
| cookies.md | `/cookies` | Politique cookies et contenu du panneau « Cookie settings » |

À produire en plus de ces pages (obligations RGPD, hors site) : **registre des traitements** (un tableau par finalité, reprenant `privacy.md`) et **accords de sous-traitance (DPA)** acceptés chez chaque prestataire (Cloudflare, Neon, Sightengine, Resend, PostHog, Sentry, GitHub, régie publicitaire).

Rendu : contenu Markdown dans `content/legal/{en,fr}/*.md`, affiché par une page Nuxt unique ; la version FR est une traduction à faire relire (le français prévaut pour les utilisateurs en France si une divergence existe — à confirmer).
