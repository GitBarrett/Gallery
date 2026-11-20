# 05 — FinOps

## Hypothèses
- Tranches en utilisateurs actifs mensuels (MAU).
- 10 % des MAU publient ~5 images/mois de 8 Mo ; variantes ≈ 1 Mo par capture (ADR-012).
- Stockage cumulé à 12 mois. 60 pages vues et ~100 événements analytics par MAU.
- Modération : 2 opérations Sightengine par image.
- Transformations : 6 transformations uniques par capture, une seule fois (ADR-012) ; 5 000 gratuites par mois, puis 0,50 $ / 1 000.
- Prix publics vérifiés le 17/11/2026 (Cloudflare, Neon, Resend, Sightengine), à revérifier avant lancement.

## Estimation mensuelle (USD, ordre de grandeur)

| Poste | 5k | 10k | 20k | 50k | 100k |
|---|---|---|---|---|---|
| Images publiées / mois | 2 500 | 5 000 | 10 000 | 25 000 | 50 000 |
| Stockage R2 à 12 mois (originaux + variantes) | 270 Go | 540 Go | 1,1 To | 2,7 To | 5,4 To |
| Workers (forfait 5 $ + requêtes et CPU) | 5 | 5 | 7 | 16 | 29 |
| R2 | 4 | 8 | 16 | 41 | 81 |
| Transformations d'images (binding Images, ADR-012) | 5 | 13 | 28 | 73 | 148 |
| Neon (plan Launch, 0,106 $ / CU-h, calcul toujours actif) | 20 | 25 | 40 | 80 | 120 |
| Sightengine | 29 | 29 | 49 | 119 | 219 |
| PostHog | 0 | 0 | 50 | 153 | 324 |
| Resend (Pro dès l'ouverture ; récap v1.x en haut de grille) | 20 | 20 | 20 | 35 | 100 |
| Plan de zone Cloudflare (Pro : WAF géré, OWASP, 2 règles de limitation) | 0 | 0 | 20 | 20 | 20 |
| Turnstile, Access (≤ 50 utilisateurs), Web Analytics | 0 | 0 | 0 | 0 | 0 |
| Suivi d'erreurs et disponibilité (Sentry, sonde) | 0 | 0 | 0 | 26 | 26 |
| Sauvegardes (`pg_dump` sur R2) | < 1 | < 1 | < 1 | 1 | 2 |
| **Total** | **≈ 85** | **≈ 100** | **≈ 230** | **≈ 565** | **≈ 1 070** |

Coût ≈ 0,01 à 0,02 $ par MAU. Revenu pub indicatif à 100k MAU : 6 M pages vues × 2 $ RPM ≈ 12 000 $/mois.

**Écart avec la version précédente (revue du 17/11/2026)** : total plus élevé de 35 à 210 $/mois selon la tranche, pour des raisons vérifiées :
- **Resend** : le plan gratuit plafonne à 100 emails par jour ; au-delà, l'envoi s'arrête (vérifications et resets bloqués). Pro (20 $) dès l'ouverture publique.
- **Neon** : le plan gratuit donne 100 CU-heures par mois et par projet, alors qu'une base toujours active à 0,25 CU en consomme ≈ 183. La restauration à un instant donné exige aussi un plan payant.
- **Transformations** : depuis juillet 2026, le binding est facturé par transformation unique et par mois civil. Les variantes à la volée auraient refacturé chaque mois tout le catalogue consulté, soit ≈ 400 à 500 $/mois à 100k MAU. Les variantes stockées (ADR-012) coûtent 148 $, en hausse avec les seules nouvelles publications.
- **WAF** : les règles gérées et OWASP exigent le plan Pro (20 $/mois en annuel), prévu au plus tard à 20k MAU.

**Bêta fermée** (20 à 30 photographes, ≈ 200 captures) : ≈ 25 $/mois (Workers 5, Neon ≈ 20) ; Resend et Sightengine restent dans leurs offres gratuites (100 emails par jour ; 2 000 opérations par mois, 500 par jour).

## Leviers
1. PostHog : échantillonnage, pas d'autocapture, événements listés uniquement.
2. Sightengine : ne lancer que les modèles utiles.
3. Transformations : largeurs fixes, variantes écrites une seule fois ; toute nouvelle largeur = retraitement par lot chiffré avant décision.
4. Stockage : originaux conservés sans réencodage (ADR-011) ; si le stockage devient un poste important, réévaluer une conversion PNG → WebP sans perte hors Worker.
5. Neon : taille de calcul plafonnée (autoscaling 0,25 → 2 CU), requêtes de grille mises en cache 60 s par Hyperdrive.
6. Alertes de budget sur chaque service ; tableau de bord mensuel.

## Exigences techniques induites
- Tout appel payant passe par une file (Queues) avec retry borné.
- Variables de configuration pour les seuils et l'échantillonnage, sans redéploiement.
