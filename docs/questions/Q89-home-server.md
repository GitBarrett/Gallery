# Q89 — Page d'accueil : serveur (T-32a)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Découpage** : T-32a (`GET /api/home`), T-32b (l'écran) et T-32c (captures d'écran du manifest PWA, à faire sur une
    base garnie de vraies captures du jeu : action humaine).
  - **Hero** : la capture choisie par l'admin (`home.hero`, écran d'admin en T-53b) si elle est publique et assez sombre
    en bas à gauche (`luma_bl` ≤ 0,6, 07 § Hero) ; sinon — pas encore choisie, masquée, supprimée, auteur banni, trop
    claire — la dernière capture publique qui l'est ; sinon aucune (l'écran montre un dégradé, jamais un bloc vide).
    Une capture dont la luminance n'est pas mesurée n'est jamais un hero.
  - **Capture of the week** (US-70.4) : la plus likée publiée depuis 7 jours avec au moins 10 likes
    (`display.captureOfWeekMinLikes`), sinon depuis 30 jours, sinon de tous les temps, avec au moins un like (jamais
    une capture à 0 like) ; sinon l'Editor's pick (`home.editorsPick`, s'il est public) ; sinon pas de bloc. À égalité,
    la plus récente.
  - **Fenêtres sans likes datés** : tant que les likes n'ont pas de date (T-40), « sur 7 jours » porte sur la date de
    publication et le compteur de likes de la capture ; T-40 en fera les likes reçus dans la fenêtre.
  - **Dernières captures** : les 30 dernières de toutes les versions (les onglets mènent aux PLP).
  - **Bandeau de quête** : absent de la réponse tant que les concours n'existent pas (T-64).
  - **Cache** : 60 s en bordure, comme les autres lectures publiques ; un nouveau hero choisi par l'admin apparaît
    sous quelques minutes.
