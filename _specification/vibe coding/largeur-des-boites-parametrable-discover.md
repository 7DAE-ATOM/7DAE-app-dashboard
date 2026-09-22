# Feature Spec: Largeur des Boîtes Paramétrable dans Discover

## Summary
- Reprendre dans Discover le réglage déjà offert par le graphe de dépendances de **7DAE-ltm-dashboard** (cf. `temp/w1.jpg`) : un curseur **« Box width »** dans le panneau engrenage, qui fixe la largeur des boîtes d'application de tout le diagramme, valeur affichée en pixels.
- Le curseur se place **au-dessus** du réglage de courbure existant, dans le même popover (`DiscoverDisplaySettings`), et se comporte comme lui : aperçu immédiat, valeur lisible, pilotable au clavier, mémorisé durablement.
- Au passage, **renommer le libellé « Curvature » en « Link curvature »** — comme sur la capture de référence. Le mot seul ne dit pas ce que l'on courbe, alors que la section peut à terme accueillir d'autres réglages de lien.
- Le redimensionnement **par boîte**, à la poignée latérale (`ApplicationNode`), existe déjà et **n'est pas supprimé** : le curseur donne la largeur d'ensemble, la poignée reste l'ajustement fin d'une boîte particulière. L'articulation entre les deux est le seul vrai point de conception de cette feature.

## Motivation
- La largeur des boîtes est aujourd'hui figée à 200 px (`APP_NODE_WIDTH`) pour toutes les applications. Sur un diagramme de quinze nœuds, c'est large : les boîtes mangent la place et les liens se croisent faute d'espace. Sur un diagramme de trois applications aux noms longs, c'est étroit : le nom est tronqué alors que le canevas est vide.
- L'utilisateur dispose bien d'une poignée de redimensionnement, mais **boîte par boîte** : régler l'ensemble d'un diagramme demande autant de gestes qu'il y a de nœuds, et le résultat est irrégulier. Ce n'est pas le bon outil pour un réglage global.
- Le réglage existe déjà dans `7DAE-ltm-dashboard`, au même endroit (menu réglages) et sous la même forme (curseur + valeur en px). L'aligner évite à l'utilisateur d'apprendre deux interfaces pour un même besoin.
- Le coût est faible : le panneau de réglages, son store persisté et la validation champ par champ existent depuis la courbure ; la largeur est déjà une donnée de nœud (`ApplicationNodeData.width`), déjà respectée par le tracé des arêtes et par l'ancrage des cercles d'interface.

## Décisions (arbitrées)
- **Réutilisation du store existant** `lib/discoverDisplaySettings.ts` et de son panneau `components/discover/DiscoverDisplaySettings.tsx`. Pas de nouveau store, pas de nouveau point d'entrée.
- **Largeur seule.** La hauteur (`APP_NODE_HEIGHT`, 72 px) ne devient pas réglable : elle est calée sur le contenu des cartes (nom, external ID, manager) et sur la taille du camembert de capabilités.
- **Réglage continu en pixels**, pas de presets ni de pourcentage : la capture de référence affiche « 230px », et un pixel est ce que l'utilisateur voit.
- **Le réglage vaut pour les boîtes d'application uniquement.** Les cercles d'interface (`INTERFACE_NODE_SIZE`) gardent leur taille.
- **La valeur par défaut reproduit le rendu actuel** (200 px) : un utilisateur qui ne touche à rien ne voit aucun changement.
- **Aucun recalcul de disposition.** Changer la largeur ne replace pas les nœuds : les positions restent celles que l'utilisateur a posées.
- **Renommage purement libellé** : « Curvature » → « Link curvature ». Ni la clé du store (`edgeCurvature`), ni l'`id` du champ, ni l'intitulé de section (« Links ») ne changent.

## Requirements

### Functional Requirements

#### Curseur de largeur
- Un curseur **« Box width »** dans le panneau d'affichage de Discover, dans une section consacrée aux boîtes, **avant** la section « Links ».
- La valeur courante est affichée à droite du libellé, **en pixels** (ex. « 230px »), dans la même typographie chiffrée que le pourcentage de courbure.
- Plage : du minimum déjà admis par le redimensionnement manuel (`MIN_APP_NODE_WIDTH`, 120 px) à une largeur confortable pour un nom long, borne haute à arbitrer.
- L'aperçu est **immédiat** : les boîtes s'élargissent pendant le déplacement du curseur, sans validation ni rechargement.
- Le curseur est pilotable au clavier (flèches) et porte un libellé associé.

#### Articulation avec le redimensionnement par boîte
- Le curseur fixe la largeur **de référence** des boîtes d'application du diagramme.
- Une boîte que l'utilisateur a redimensionnée à la main a fait l'objet d'une décision explicite ; le comportement attendu vis-à-vis du curseur est tranché en Open Questions.
- La poignée de redimensionnement latérale reste disponible et conserve ses garde-fous actuels : plancher à `MIN_APP_NODE_WIDTH`, et impossibilité de réduire une boîte au-delà du centre d'un cercle d'interface visible de ce côté.
- Élargir par le curseur ne doit **jamais** déplacer les cercles d'interface à l'écran ni rompre leur ancrage à la bordure de la boîte : la compensation déjà appliquée au redimensionnement par le bord gauche vaut ici aussi.

#### Persistance
- La valeur est mémorisée durablement dans le navigateur, dans le même enregistrement que les autres réglages d'affichage Discover.
- Elle survit au rechargement et à la fermeture de l'onglet, et s'applique à tout nouveau diagramme ouvert.
- Elle n'est **pas** portée par l'URL : deux utilisateurs qui ouvrent le même seed Discover peuvent voir des boîtes de largeurs différentes. C'est un confort de lecture, pas une propriété du diagramme.
- Une valeur persistée invalide (absente, hors plage, non numérique) retombe silencieusement sur le défaut, selon la validation champ par champ déjà en place.

#### Diagrammes sauvegardés
- Les diagrammes sauvegardés enregistrent aujourd'hui une largeur **par application**, et seulement lorsqu'elle diffère de la largeur standard. L'arrivée d'une largeur globale réglable change la signification de cette comparaison : ce que recouvre exactement une largeur enregistrée est tranché en Open Questions.
- Rouvrir un diagramme sauvegardé avant cette évolution doit donner un rendu correct, sans boîte écrasée ni cercle d'interface décroché.

#### Renommage du libellé de courbure
- Dans le panneau de réglages, « Curvature » devient **« Link curvature »**.
- Aucun autre changement : plage, pas de 10 %, valeur par défaut, comportement et persistance sont inchangés.

### Non-Functional Requirements
- **Aucune dépendance nouvelle.**
- **Fluidité** : le déplacement du curseur redimensionne les boîtes sans à-coup sur un diagramme de taille courante ; ni les données ni la disposition ne sont recalculées.
- **Pas de recalcul de layout** : la position des nœuds est strictement inchangée par le réglage.
- **Accessibilité** : curseur atteignable au clavier, libellé explicite, valeur annoncée, unité lisible.
- **Thèmes** : aucun impact, le réglage ne touche pas aux couleurs.
- **Lisibilité du contenu** : le texte des cartes doit se comporter correctement aux deux extrémités de la plage — pas de débordement à l'étroit, pas de blanc disgracieux au large.

## Scope

### In Scope
- Ajout d'une largeur de boîte au store `lib/discoverDisplaySettings.ts`, avec défaut et validation à la restauration.
- Ajout de la section et du curseur dans `components/discover/DiscoverDisplaySettings.tsx`.
- Prise en compte de la largeur réglée par les nœuds d'application du graphe Discover, y compris le maintien de l'ancrage des cercles d'interface.
- Renommage du libellé « Curvature » en « Link curvature ».
- Comportement défini vis-à-vis des largeurs déjà présentes dans les diagrammes sauvegardés.

### Out of Scope
- **Hauteur des boîtes réglable.**
- **Taille des cercles d'interface**, des puces de data objects et des icônes d'information.
- **Redimensionnement automatique au contenu** (boîte qui s'ajuste au nom le plus long).
- **Suppression de la poignée de redimensionnement par boîte.**
- **Zoom** : le curseur change la taille des boîtes, pas l'échelle du canevas ; les deux restent indépendants.
- **Exports** (PNG, SVG, Mermaid) : aucune évolution propre, au-delà du fait qu'un export rende ce qui est affiché.
- Le graphe étoile de la fiche application et le graphe `/depgraph`.
- Toute modification du catalogue, de la carte ou de la fiche application.

## Affected Areas
- **Modifier** :
  - `lib/discoverDisplaySettings.ts` — nouvelle valeur numérique, défaut, validation.
  - `components/discover/DiscoverDisplaySettings.tsx` — section « boîtes », curseur, et libellé « Link curvature ».
  - `components/discover/DiscoverGraph.tsx` — largeur de référence des nœuds d'application, articulation avec `handleResizeApplication` et avec la sauvegarde/restauration de diagramme.
  - `components/discover/ApplicationNode.tsx` — uniquement si le repli sur `APP_NODE_WIDTH` doit devenir un repli sur la largeur réglée.
  - `lib/discoverDiagramSaves.ts` — uniquement si la sémantique de la largeur enregistrée doit évoluer.
- **Non touché** : `components/discover/GraphEdge.tsx` (le tracé lit déjà la géométrie des boîtes), `components/discover/InterfaceNode.tsx`, `lib/discover-graph-layout.ts` hormis d'éventuelles bornes, `lib/discoverMermaid.ts`, `components/discover/DiscoverExportMenu.tsx`.

## Edge Cases
- **Largeur minimale** : les boîtes restent lisibles, le nom tronqué proprement, et aucun cercle d'interface ne se retrouve hors de sa bordure.
- **Largeur maximale** : deux boîtes voisines peuvent se chevaucher, puisque la disposition n'est pas recalculée — c'est admis, l'utilisateur déplace ce qui le gêne.
- **Boîte redimensionnée à la main puis curseur déplacé** : le comportement doit être prévisible et identique pour toutes les boîtes dans le même cas.
- **Réduction sous la position d'un cercle d'interface attaché** : le garde-fou existant doit tenir, quelle que soit l'origine de la réduction.
- **Diagramme sauvegardé avant cette évolution**, contenant des largeurs par application : réouverture sans régression.
- **Diagramme vide** : le curseur reste utilisable et sans effet visible.
- **Valeur persistée corrompue ou stockage indisponible** (navigation privée) : retour silencieux au défaut.
- **Vue simplifiée et vue interfaces** : le réglage s'applique aux deux, les cercles d'interface n'existant que dans la seconde.
- **Réglage déplacé pendant un glisser-déposer de nœud** : aucun état résiduel, aucune boîte laissée à une largeur intermédiaire.

## Open Questions
- **Le curseur écrase-t-il les largeurs réglées à la main ?** Recommandation : **oui, il les écrase** — un réglage global qui laisserait des exceptions invisibles donnerait un diagramme irrégulier sans que l'utilisateur comprenne pourquoi ; et la poignée reste disponible pour rétablir une exception après coup. => non ne les touche pas si l'utilisateur les a réglé à la main

- **Borne haute de la plage** : 320 px, 400 px ? Recommandation : **400 px**, ce qui laisse place à un nom long sans permettre une boîte absurde. => suivre recommendation

- **Graduation du curseur** : continu au pixel, ou par crans ? Recommandation : **crans de 10 px**, cohérents avec les crans de 10 % de la courbure et plus faciles à reproduire. => suivre recommendation

- **Que recouvre la largeur enregistrée dans un diagramme sauvegardé ?** Recommandation : **conserver la largeur par application telle quelle**, et la comparer désormais à la largeur réglée plutôt qu'à la constante — un diagramme reste un objet partageable, avec ses éventuelles exceptions. => suivre recommendation

- **Intitulé de la nouvelle section** dans le panneau : « Boxes », « Nodes », « Layout » ? Recommandation : **« Boxes »**, cohérent avec le libellé « Box width » de la capture de référence. => utilisé "Box width"

- **Le réglage s'applique-t-il rétroactivement au diagramme déjà ouvert, ou seulement aux suivants ?** Recommandation : **immédiatement au diagramme ouvert** — sans quoi l'aperçu en direct, qui est l'intérêt du curseur, disparaît. => suivre recommendation 

## Acceptance Criteria
- [ ] Le panneau d'affichage de Discover expose un curseur « Box width », au-dessus de la section des liens, avec la valeur courante affichée en pixels.
- [ ] Le déplacement du curseur redimensionne les boîtes d'application immédiatement, sans déplacer un seul nœud.
- [ ] La valeur par défaut reproduit le rendu actuel (200 px).
- [ ] Le réglage s'applique à la vue simplifiée comme à la vue interfaces.
- [ ] Les cercles d'interface restent ancrés à la bordure de leur boîte à toutes les largeurs, sans saut à l'écran.
- [ ] La poignée de redimensionnement par boîte reste fonctionnelle, avec ses garde-fous (plancher minimal, cercle d'interface visible).
- [ ] Le réglage est conservé après rechargement **et** après fermeture puis réouverture de l'onglet.
- [ ] Une valeur persistée invalide, ou un stockage indisponible, retombe sur le défaut sans erreur ni boîte cassée.
- [ ] Le curseur est utilisable au clavier et porte un libellé explicite.
- [ ] Un diagramme sauvegardé avant cette évolution se rouvre sans régression visuelle.
- [ ] Le panneau affiche « Link curvature » à la place de « Curvature », sans autre changement de ce réglage.
- [ ] Aucune modification de la hauteur des boîtes, de la taille des cercles d'interface, des exports, du graphe étoile ni de `/depgraph`.
