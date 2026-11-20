# TODO — Legendary Shots

Mémoire partagée entre Adrien et Claude Code. Date de dernière mise à jour : 2026-11-18. Specs à jour (63 stories, 274 critères, 68 tâches). Reste : maquettes et placeholders du canevas, non encore faits.

## À faire dans le pack (avant de lancer le code)

- [x] Ajouter la phase de prototypes T-00a à T-00h avant T-03, avec critères de réussite et replis.
- [x] Rendre T-02 et T-03 dépendants de T-00h.
- [x] Ajouter une ligne dans `CLAUDE.md` pour la phase T-00.
- [x] Ajouter Q19 : lancement des prototypes avant l'infrastructure (en attente de décision).
- [x] Ajouter l'épique E-SUPPORT (v1.x, derrière `features.donations`) : dons ponctuels d'abord, pas de récurrence pour l'instant.
- [x] Ajouter la table `donations` (prestataire, montant, devise, statut, date, indicateur de badge), créée avec le flag désactivé.
- [x] Ajouter Q20 : statut juridique (entreprise ou association) et fiscalité des dons.
- [x] Ajouter Q21 : vérifier que le prestataire de paiement accepte le contenu du site (jeux vidéo).
- [x] Noter la disposition des emplacements publicitaires dans `07-design.md` et dans US-73 : pied de page, grille (une annonce après 24 captures), colonne latérale de la page photo, jamais au-dessus de l'image, jamais dans le hero.
- [x] Ajouter la mention « Advertisement » et la réserve de hauteur (CLS) pour chaque emplacement.
- [ ] Placeholders « Ad slot — v1.x, features.ads » dans le canevas (sans contenu de régie).
- [ ] Maquettes de dons dans le canevas, marquées « v1.1, masqué par le flag » : bouton « Support the site », page `/support`, écran de remerciement, badge « Supporter ».

## Décisions attendues d'Adrien

- [ ] Q13 à Q19 : voir `docs/09-questions-ouvertes.md`.
- [ ] Montant minimum des dons : 2 € (décidé à l'oral), montants suggérés 2 €, 5 €, 10 €. À vérifier sur la grille du prestataire.
- [ ] Dons récurrents : écartés pour l'instant.
- [ ] Régie publicitaire : AdSense en v1.x, à confirmer (Q2) ; vérifier le consentement IAB TCF v2.2.

## Avant la v1.1

- [ ] Choisir le prestataire de dons et vérifier sa grille tarifaire.
- [ ] Trancher le statut juridique et la fiscalité (validation par un professionnel).
- [ ] Choisir la régie publicitaire après quelques mois de trafic.

## Hors pack (actions humaines)

- [ ] Domaine (Q3).
- [ ] Comptes : Cloudflare, Neon, GitHub, Sentry, Resend.
- [ ] GitHub App et client OAuth Google et Battle.net.
- [ ] Registre RGPD.
- [ ] Premier compte administrateur.
- [ ] Vérifier le WebP sans perte comme fond d'écran (Q18, à faire en T-34).

## Décision : Ponytail (18/11/2026)

- [x] Lu `AGENTS.md` et `skills/ponytail/SKILL.md` (dépôt DietrichGebert/ponytail, commit 96608e0).
- Décision initiale : ne pas installer le plugin.
- **Révisée le 20/11/2026 (Adrien) : plugin conservé**, installé au niveau utilisateur (`~/.claude/settings.json`). Pas de conflit avec la règle 3 : un changement trivial ne porte aucun critère d'acceptation, et tout critère [MVP] sans test est bloqué par `pnpm test:trace`.
- Le principe reste aussi écrit en règle 10 de `CLAUDE.md`, avec le format `shortcut:` pour les raccourcis.

## Décision : CSS (18/11/2026)

- [x] CSS natif retenu (ADR-014) : `tokens.css`, `base.css`, `<style scoped>`, Stylelint. Règle 11 de `CLAUDE.md` : maquettes = référence visuelle, jamais copiées. Tâche T-06 mise à jour.
