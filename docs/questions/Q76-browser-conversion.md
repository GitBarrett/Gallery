# Q76 — Conversion dans le navigateur (T-26b)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Encodeurs** : `@jsquash` (encodeurs de Squoosh, Apache-2.0), décodeur TGA maison ; décision en ADR-020.
  - **Chaîne** : un TGA devient un PNG sans perte ; s'il dépasse encore 20 Mo, un WebP sans perte ; sinon un JPEG
    qualité 95 en 4:4:4 avec un avertissement. Un PNG de plus de 20 Mo commence au WebP. Un JPEG ou un WebP de plus
    de 20 Mo n'est pas converti : refusé avec son motif.
  - **Contrôle avant conversion** : les dimensions (640 à 7680 px, 33,2 Mpx au plus) sont vérifiées sur l'en-tête du
    TGA ou sur l'image avant de lancer la conversion, puis le fichier converti passe les règles habituelles.
  - **TGA reconnu** à son extension `.tga` (les navigateurs ne lui donnent pas de type) ; types 2 et 10 (brut et
    RLE), 24 et 32 bits ; un autre TGA est refusé (« could not be converted »).
  - **Canal alpha** : gardé en PNG et WebP sans perte, perdu en JPEG (fond noir) ; les captures de WoW n'en ont pas.
  - **Mémoire** : un échec du worker (mémoire, worker tué) ou du décodage affiche « Convert this file on a computer »
    et laisse choisir un autre fichier ; pas de seuil de mémoire estimé à l'avance.
  - **Nom du fichier** : l'extension suit le nouveau format (`capture.tga` → `capture.png`).
  - **Temps** : une capture 8K essaie PNG puis WebP sans perte avant le JPEG, soit une à deux minutes sur un
    ordinateur ; un message « Converting in your browser… » s'affiche pendant ce temps, sans barre de progression.
