# Feature Spec: Export du diagramme Discover en PNG et SVG

## Summary
- Le menu **Export** de `/discover` propose déjà trois formats, mais seul **Mermaid** est actif : **PNG** et **SVG** y figurent grisées avec la mention « Soon ». Cette spec les rend fonctionnelles.
- L'export produit une **image du diagramme tel qu'il est composé**, graphe entier — pas seulement la portion visible à l'écran — et sans l'outillage d'interface (grille de fond, contrôles de zoom, bandeaux, poignées de redimensionnement, panneau de mise en évidence).
- Les deux formats suivent automatiquement le mode d'affichage **Simple / Complex**, les réglages de l'engrenage et le thème actif : ils capturent ce qui est rendu, là où Mermaid reconstruit à partir du modèle.
- L'application étant déployée **hors ligne**, toute bibliothèque nécessaire est installée en **dépendance npm** à version exacte et chargée paresseusement.

## Motivation
- Mermaid répond au besoin « texte versionnable », pas au besoin « image à coller ». Pour glisser le diagramme dans une slide, un mail ou un compte rendu, il faut aujourd'hui faire une capture d'écran — donc perdre ce qui dépasse du cadre, et livrer une image à la résolution de l'écran.
- Le passage par draw.io fonctionne pour Mermaid mais impose un détour et une remise en page ; il ne convient pas quand on veut simplement montrer le résultat d'une exploration.
- Contrairement à Mermaid, ces deux formats restituent **la disposition construite par l'utilisateur** : les positions qu'il a ajustées à la main, la couronne d'interfaces autour de chaque application, la mise en évidence en cours. C'est précisément le travail que le format texte jette.
- Les deux entrées existent déjà dans le menu. Les laisser inertes durablement transforme une promesse en dette visible.

## Décisions (arbitrées)

### Une capture du rendu, pas une seconde sérialisation
- Mermaid part du **modèle** (`snapshot()` du graphe) ; PNG et SVG partent du **DOM rendu** par React Flow. Ce sont deux mécanismes sans rien de commun, et il ne faut pas chercher à les unifier.
- Conséquence heureuse : tout ce qui influence l'affichage — mode Simple/Complex, commutateurs Nom / External ID / Manager, thème clair ou sombre, mise en évidence — est pris en compte **sans une ligne de code dédiée**. Là où l'export Mermaid a dû apprendre le mode, la capture le suit par construction.

### Le graphe entier, pas la fenêtre
- L'export couvre l'**étendue complète** du diagramme, quel que soit le zoom ou le recadrage courant, avec une marge régulière autour.
- Le niveau de zoom à l'écran ne doit **pas** influer sur le contenu de l'image ; il ne doit pas non plus être modifié par l'export (pas de recadrage automatique visible par l'utilisateur).

### Ce qui est exclu de l'image
- La grille de fond, les contrôles de zoom, les bandeaux de chargement et d'erreur, le menu contextuel, le panneau de mise en évidence.
- Les affordances d'édition portées par les nœuds : poignées de redimensionnement et bouton d'information. Ce sont des commandes, pas du contenu.
- Reste donc : les rectangles d'application, les cercles d'interface le cas échéant, les liens et leurs flèches.

### Ce qui est conservé
- Les **couleurs du thème actif**. Un diagramme exporté en thème sombre sort dans les couleurs du thème sombre : c'est ce que l'utilisateur voit, et lui imposer une conversion serait une surprise.
- L'état de **mise en évidence** en cours, atténuation des éléments non concernés comprise : c'est une information volontairement produite par l'utilisateur, pas un artefact.

### Nature du SVG : une capture, pas un moteur de rendu
- Le SVG produit est **fidèle au rendu** : il encapsule le contenu tel que le navigateur l'affiche. C'est la solution la plus simple, et elle sort dans cette itération.
- Conséquence assumée : le fichier s'ouvre correctement dans un navigateur, mais **ses éléments ne sont pas des formes vectorielles éditables** dans un outil de dessin, et certains lecteurs le rendront mal. Un vrai SVG vectoriel supposerait de redessiner le diagramme à partir du modèle — un second moteur de rendu, hors de ce lot.

### Fond du PNG : transparent
- Le PNG sort **sans fond**, ce qui permet de le poser sur n'importe quel support sans bande rectangulaire autour.
- Contrepartie à surveiller à l'usage : un diagramme exporté en **thème sombre** — texte clair — devient illisible collé sur une slide blanche. Aucun réglage n'est offert dans cette itération ; le contournement est de basculer l'application en thème clair avant d'exporter.

### Résolution : facteur ×2, borné
- L'image fait **deux fois** la taille logique du diagramme. Ce qui doit rester constant est l'**échelle appliquée au texte**, pas les dimensions du fichier : une carte d'application fait 200 × 60 px logiques avec un nom en 14 px, qui devient ainsi un 28 px net quel que soit le nombre de nœuds.
- L'alternative — viser une largeur fixe — garderait les dimensions constantes et laisserait la lisibilité s'effondrer : sur un graphe de plusieurs centaines d'applications, le nom tomberait sous les 6 px.
- L'échelle est **plafonnée par les limites du navigateur** : côté maximal et surface totale maximale d'un canvas. Au-delà, la génération produirait un fichier vide ou échouerait sans rien dire.

### Au-delà de la borne : refuser en l'expliquant
- Quand le plafond est atteint, l'export PNG **n'est pas dégradé silencieusement** : il est refusé avec un message.
- Raison : à ce volume, aucun PNG ne serait lisible à quelque taille que ce soit. Réduire la résolution produirait un fichier lourd, illisible, et donnerait l'illusion d'avoir réussi.
- Le message doit orienter vers les formats qui, eux, tiennent l'échelle : **SVG** ou **Mermaid**.

### Contrainte hors ligne
- Version exacte dans `dependencies` (le fichier n'utilise ni `^` ni `~`), résolution au build, aucun CDN.
- Chargement **paresseux**, comme le moteur PDF du catalogue : `/discover` est déjà lourde et l'outillage d'image ne doit pas entrer dans son bundle initial.
- **Piège à traiter** : les polices sont chargées depuis Google Fonts (`app/globals.css`). Hors ligne, elles n'arrivent jamais et l'application se rabat déjà sur des polices système ; une image exportée doit rester lisible et cohérente dans ce cas, et ne doit surtout pas tenter d'aller chercher une police au moment de l'export.

### Nommage et déclenchement
- Même convention que les exports existants : nom horodaté, extension du format, téléchargement côté navigateur sans aller-retour serveur.
- Pendant la génération, l'entrée du menu doit indiquer qu'un travail est en cours et ne pas pouvoir être relancée — comme le fait déjà le bouton d'export PDF du catalogue.

## Requirements

### Functional Requirements
- Les entrées PNG et SVG du menu Export sont actives et produisent chacune un fichier téléchargé.
- L'image contient l'intégralité du diagramme, avec une marge homogène, indépendamment du zoom et du déplacement courants.
- L'outillage d'interface listé plus haut est absent de l'image.
- Le thème actif, le mode Simple/Complex, les réglages d'affichage des cartes et la mise en évidence sont respectés.
- Le niveau de zoom et la position du graphe à l'écran sont inchangés après un export.
- Les entrées restent indisponibles tant que le graphe est vide, comme l'entrée Mermaid.
- Une génération en cours est signalée et ne peut pas être déclenchée deux fois.
- Un échec de génération est signalé à l'utilisateur, sans casser la page.

### Non-Functional Requirements
- **Hors ligne** : aucune ressource distante, ni au build ni à l'exécution.
- **Bundle** : aucun impact sur le chargement initial de `/discover`.
- **Aucun appel réseau** au moment de l'export.
- Le texte doit être **lisible** dans l'image produite : une image à la résolution exacte de l'écran est insuffisante pour un diagramme dense.
- Un graphe de quelques centaines de nœuds doit produire un fichier ou échouer **proprement**, jamais figer l'onglet sans explication.
- Le plafond de surface au-delà duquel le PNG est refusé doit être déterminé à partir des limites réelles du navigateur, pas d'un seuil arbitraire codé au jugé.
- Aucune régression sur le graphe : l'export ne déplace, ne resélectionne et ne recadre rien.

## Scope

### In Scope
- Activation des deux entrées de menu et génération des fichiers.
- Cadrage sur l'étendue complète du graphe et exclusion de l'outillage d'interface.
- Ajout et verrouillage de version de la dépendance nécessaire.
- Indication d'avancement et gestion d'erreur.

### Out of Scope
- Toute option d'export (choix de résolution, de marge, de fond, de thème) : cette itération livre un comportement unique, sans réglage.
- L'export au format PDF depuis Discover.
- La copie de l'image dans le presse-papiers.
- L'impression.
- Toute modification de l'export Mermaid existant.
- L'export depuis le catalogue ou la carte.

## Affected Areas
- **Modifier** : `components/discover/DiscoverExportMenu.tsx` — les deux entrées cessent d'être inertes ; le composant gagne un état « génération en cours » et deux rappels d'action.
- **Modifier** : `components/DiscoverClient.tsx` — c'est lui qui détient déjà le rappel d'export Mermaid et la règle « graphe vide ⇒ menu désactivé » ; les deux nouvelles actions s'y branchent de la même façon.
- **Créer** : un module d'export image, sans JSX, isolant le cadrage, le filtrage des éléments et la production du fichier — pour que ni le menu ni le graphe n'aient à connaître ces détails.
- **À traiter** : `components/discover/DiscoverGraph.tsx` — la capture a besoin d'atteindre le conteneur rendu par React Flow et l'étendue des nœuds. Aujourd'hui l'interface impérative du graphe (`DiscoverGraphHandle`) expose l'ajout, le retrait et l'instantané ; il faut décider si elle s'étend à nouveau, comme elle l'a fait pour Mermaid, ou si l'export atteint le DOM autrement. C'est le point de conception de cette feature.
- **Réutiliser** : `lib/downloadBlob.ts` (`downloadBlob`, `exportDateStamp`), écrit précisément pour être partagé entre exports.
- **Réutiliser** : le schéma d'import paresseux et de gestion d'erreur de `handleExportPdf` dans `components/useApplicationActions.tsx`.
- **Modifier** : `package.json` — la dépendance d'export image, en version exacte.
- **Non touché** : `lib/discoverMermaid.ts` et l'instantané du graphe, `ApplicationNode`, `InterfaceNode`, `GraphEdge`, les requêtes LeanIX.

## Edge Cases
- **Nœuds en HTML, pas en SVG** : React Flow dessine les cartes d'application en HTML et seuls les liens sont en SVG. Un « export SVG » obtenu en encapsulant le rendu produit donc un fichier **valide et fidèle dans un navigateur**, mais dont le contenu reste du HTML embarqué : il ne s'ouvre pas comme des formes vectorielles éditables dans un outil de dessin, et certains lecteurs le rendent mal, voire pas du tout. C'est le point le plus important de cette spec — voir Open Questions.
- **Graphe vide** → action indisponible, comme pour Mermaid.
- **Très grand graphe** → au-delà de la surface qu'un canvas accepte, le PNG est refusé avec un message orientant vers SVG ou Mermaid ; jamais un onglet figé, un fichier vide ou une image tronquée sans avertissement. Le SVG, lui, n'a pas cette limite et doit rester proposé.
- **Fond transparent sur thème sombre** → l'image collée sur un support clair devient illisible. Comportement voulu et non réglable ici : à surveiller à l'usage.
- **Polices absentes** (déploiement hors ligne, ou police non embarquée) → l'image doit rester lisible avec les polices de repli, et les largeurs de texte ne doivent pas déborder des cartes.
- **Couleurs exprimées en variables CSS et en `color-mix`** → tout le thème repose dessus ; elles doivent être correctement résolues dans le fichier produit, sinon les couleurs partent en noir ou en transparent.
- **Fond du PNG** : un fond transparent est pratique pour une slide sombre, mais rend un diagramme de thème sombre illisible sur fond blanc. Le comportement doit être tranché une fois pour toutes, cette itération n'offrant aucun réglage.
- **Nœud partiellement hors écran** au moment du clic → doit apparaître entièrement dans l'image ; c'est tout l'objet du cadrage sur l'étendue complète.
- **Export déclenché pendant un chargement de relations** → soit interdit, soit capture l'état courant, mais jamais un graphe à moitié construit sans que l'utilisateur en soit averti.
- **Deux exports successifs** → deux fichiers, aucun état résiduel, aucun recadrage visible entre les deux.
- **Mise en évidence active** → conservée, y compris l'atténuation des éléments non concernés.

## Open Questions

Aucune. Les cinq questions posées à la rédaction ont été tranchées et déplacées dans
**Décisions (arbitrées)** ; rappel de leur résolution, pour mémoire :

| Question | Arbitrage |
|---|---|
| Nature du SVG | Capture fidèle au rendu, pas de moteur vectoriel |
| Fond du PNG | Transparent |
| Thème de l'image | Le thème actif |
| Résolution du PNG | Facteur ×2, borné par les limites du navigateur |
| Au-delà de la borne | Refus explicite, orientation vers SVG ou Mermaid |

## Acceptance Criteria
- [ ] Les entrées PNG et SVG du menu Export sont actives et téléchargent chacune un fichier au nom horodaté.
- [ ] L'image contient tout le diagramme, y compris ce qui était hors écran, avec une marge homogène.
- [ ] Grille de fond, contrôles de zoom, bandeaux, poignées de redimensionnement, boutons d'information et panneau de mise en évidence sont absents de l'image.
- [ ] Un export lancé en mode Simple ne montre aucun cercle d'interface ; le même en mode Complex les montre.
- [ ] Les couleurs correspondent au thème actif et la mise en évidence en cours est conservée.
- [ ] Le PNG fait deux fois la taille logique du diagramme, et son texte est lisible à l'ouverture sans zoomer.
- [ ] Le PNG a un fond transparent.
- [ ] Sur un graphe dépassant les limites de canvas du navigateur, l'export PNG est refusé avec un message orientant vers SVG ou Mermaid — pas de fichier vide, pas d'onglet figé ; le SVG reste possible.
- [ ] Le zoom et la position du graphe sont identiques avant et après l'export.
- [ ] Le menu signale la génération en cours et interdit un second déclenchement simultané.
- [ ] Un échec est signalé sans casser la page.
- [ ] Les entrées sont indisponibles sur un graphe vide.
- [ ] Aucune ressource distante n'est requise ; la dépendance ajoutée est en version exacte dans `package.json`.
- [ ] Le chargement initial de `/discover` n'embarque pas l'outillage d'export image.
- [ ] Build Next OK, aucune régression sur l'export Mermaid ni sur le graphe.
