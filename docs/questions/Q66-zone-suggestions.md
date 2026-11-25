# Q66 — Catalogue : suggestion des zones (T-20b)

- **Statut** : Tranché — Adrien, 25/11/2026 (options appliquées retenues)
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - Le seed `docs/seed/zones.csv` est importé par une migration (0011), comme les versions du jeu (Q65) : la production et chaque preview l'ont dès la migration. Un test vérifie que la base contient exactement le CSV ; une modification du CSV demande donc une nouvelle migration.
  - Les zones (comme les versions) sont des données de référence conservées par `emptyData` (remise à zéro de la base de démo).
  - `GET /api/zones/suggest?q=` : zones `active` seulement, 10 au plus, dès le premier caractère. La saisie est normalisée comme un tag (minuscules, sans accents) et cherchée dans le nom EN, le nom FR et les alias. Une zone est proposée si le texte y figure tel quel, ou si sa similarité de mots `pg_trgm` atteint 0,5 (seuil abaissé depuis 0,6 pour que « hurlvent » trouve Hurlevent). Ordre : similarité décroissante, puis nom anglais.
  - La réponse donne le `slug`, le nom EN et le nom FR ; le choix de la langue affichée (US-62.4) revient au client (T-21). Les deux noms sont obligatoires en base : le repli sur l'anglais ne joue que si un nom FR est vide.
