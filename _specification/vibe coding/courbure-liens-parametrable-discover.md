# Feature Spec: Courbure des Liens Paramétrable dans Discover

## Summary
- Deux évolutions du tracé des arêtes du graphe Discover, à livrer ensemble :
  1. **Plafonner la courbure** (point A) — le décalage du point de contrôle est aujourd'hui strictement proportionnel à la longueur de l'arête, ce qui fait partir les liens longs en larges boucles. Un plafond en pixels borne l'amplitude, quelle que soit la distance entre les deux nœuds.
  2. **Rendre la courbure réglable** (point B) — un curseur dans le panneau d'affichage de Discover, de **lignes parfaitement droites** à une courbure généreuse, appliqué en direct à toutes les arêtes.
- Le réglage est une **préférence utilisateur persistante**, mémorisée à côté des trois interrupteurs d'affichage existants (`lib/discoverDisplaySettings.ts`), et non un état du graphe : il suit l'utilisateur, pas le diagramme.
- Le comportement par défaut reproduit le rendu actuel (courbure ~16 % de la longueur), **plafond compris** : un utilisateur qui ne touche à rien voit simplement disparaître les boucles excessives des liens longs.
- Les deux modes de vue de Discover sont concernés — vue simplifiée (application → application) et vue interfaces — puisqu'ils empruntent la même arête `graphEdge`.

## Motivation
- Le décalage du point de contrôle vaut `longueur × 0,16` (`components/discover/GraphEdge.tsx`). Un même coefficient ne peut pas convenir à la fois à un lien court et à un lien traversant l'écran : sur un graphe réel, les arêtes longues partent en arcs qui passent au-dessus d'autres nœuds et brouillent la lecture, alors que les courtes sont à peine incurvées.
- Il n'existe **aucune préférence universelle** en la matière : pour lire des dépendances on veut des lignes droites, presque un schéma technique ; pour présenter une vue d'ensemble on préfère des courbes qui se distinguent les unes des autres et se croisent proprement. Aujourd'hui l'utilisateur subit un compromis figé.
- C'est le réglage le moins coûteux qui change le plus le rendu : un seul coefficient, déjà isolé dans une variable, et un panneau de réglages Discover qui existe déjà avec sa persistance.
- Les arêtes parallèles alternent déjà leur sens de courbure (`bend` ±1) pour ne pas se superposer — ce mécanisme est acquis et doit être préservé par le nouveau réglage.

## Décisions (arbitrées)
- **Périmètre strictement A + B.** Le défaut d'ancrage identifié en parallèle — les extrémités sont calculées sur la droite centre-à-centre alors que le tracé est courbe, si bien que les liens abordent la bordure de biais — n'est **pas** traité ici. Il fait l'objet d'une itération séparée.
- **Réutilisation du store existant** `lib/discoverDisplaySettings.ts` et de son panneau `components/discover/DiscoverDisplaySettings.tsx` (popover engrenage). Pas de nouveau store, pas de nouveau point d'entrée dans l'interface.
- **Réglage continu, pas de presets.** Un curseur, pas trois boutons « droit / normal / courbé » : la valeur intéressante dépend de la densité du graphe affiché, l'utilisateur ajuste en regardant.
- **Le réglage vaut pour toutes les arêtes.** Pas de courbure par arête ni par type de lien.
- **La valeur par défaut reproduit le rendu actuel**, pour que la mise à jour ne surprenne personne.

## Requirements

### Functional Requirements

#### Plafond de courbure (A)
- L'amplitude de la courbure est bornée par un **maximum exprimé en pixels du graphe**, indépendant du niveau de zoom.
- En dessous du plafond, le comportement proportionnel actuel est conservé : les arêtes courtes ne changent pas.
- Le plafond s'applique **avant** le réglage utilisateur : réduire la courbure part d'une amplitude déjà bornée.
- Effet attendu : deux liens de longueurs très différentes présentent un galbe comparable, au lieu d'un arc démesuré pour le plus long.

#### Curseur de courbure (B)
- Un curseur dans le panneau d'affichage de Discover, sous une section distincte de « Show on cards » (les interrupteurs existants concernent le contenu des cartes, pas le tracé des liens).
- Plage : de **0 %** (lignes strictement droites) à **100 %** (courbure maximale retenue). Valeur par défaut : le niveau actuel.
- L'aperçu est **immédiat** : le graphe se retrace pendant que l'utilisateur déplace le curseur, sans validation ni rechargement.
- La valeur courante est lisible à côté du curseur (pourcentage), pour qu'un réglage puisse être reproduit.
- Le curseur est pilotable au clavier (flèches), avec un libellé associé.

#### Persistance
- La valeur est mémorisée durablement dans le navigateur, dans le même enregistrement que les trois interrupteurs d'affichage Discover.
- Elle survit au rechargement et à la fermeture de l'onglet, et s'applique à tout nouveau graphe ouvert.
- Elle n'est **pas** portée par l'URL et ne fait pas partie du graphe partagé : deux utilisateurs qui ouvrent le même seed Discover peuvent voir des courbures différentes. C'est voulu — c'est un confort de lecture, pas une propriété du diagramme.
- Une valeur persistée invalide (absente, hors plage, non numérique) retombe silencieusement sur le défaut. Le mécanisme de restauration actuel fusionne l'objet stocké avec les valeurs par défaut sans le valider : l'ajout d'une valeur numérique impose d'introduire cette validation, sans quoi une donnée corrompue produirait un tracé cassé.

#### Portée du réglage
- Le réglage s'applique aux arêtes de la **vue simplifiée** comme de la **vue interfaces**.
- Les arêtes parallèles entre deux mêmes nœuds doivent **rester distinguables**, y compris à courbure nulle : c'est aujourd'hui l'alternance de courbure qui les sépare, mécanisme qui disparaît quand la courbure tend vers zéro.
- Le sens des liens (flèche côté cible), la couleur et l'épaisseur ne changent pas.
- Les effets de mise en évidence au survol et à la sélection (atténuation et emphase des arêtes) restent fonctionnels à toutes les valeurs.

### Non-Functional Requirements
- **Aucune dépendance nouvelle.**
- **Fluidité** : le déplacement du curseur retrace les arêtes sans à-coup sur un graphe de taille courante ; seul le tracé doit être recalculé, pas la disposition des nœuds ni les données.
- **Pas de recalcul de layout** : la position des nœuds est strictement inchangée par le réglage.
- **Accessibilité** : curseur atteignable au clavier, libellé explicite, valeur annoncée.
- **Thèmes** : aucun impact, le réglage ne touche pas aux couleurs.

## Scope

### In Scope
- Plafonnement de l'amplitude de courbure dans le composant d'arête.
- Lecture d'un facteur de courbure depuis les réglages d'affichage Discover.
- Ajout de la valeur au store `lib/discoverDisplaySettings.ts`, avec validation à la restauration.
- Ajout du curseur et de sa section dans `components/discover/DiscoverDisplaySettings.tsx`.
- Préservation de la séparation des arêtes parallèles à courbure nulle.

### Out of Scope
- **Correction de l'ancrage** (extrémités perpendiculaires à la bordure, choix d'un côté de sortie) — itération séparée, bien que ce soit le défaut visuel le plus important après celui-ci.
- **Tracés orthogonaux** (coudes à angle droit, style schéma d'architecture).
- **Édition arête par arête** (menu contextuel, poignée de contrôle déplaçable).
- **Exports** : PNG et SVG sont aujourd'hui des entrées inertes du menu d'export, et Mermaid ne sait pas exprimer une courbure arbitraire — aucun des trois n'est modifié.
- Partage du réglage via le seed Discover ou l'URL.
- Toute modification du graphe `/depgraph` ou de la vue étoile.
- Épaisseur, couleur, style de trait (pointillés) et marqueurs des arêtes.

## Affected Areas
- **Modifier** :
  - `components/discover/GraphEdge.tsx` — plafond d'amplitude et prise en compte du facteur de courbure.
  - `lib/discoverDisplaySettings.ts` — nouvelle valeur numérique, défaut, validation à la restauration.
  - `components/discover/DiscoverDisplaySettings.tsx` — section et curseur.
  - `components/discover/DiscoverGraph.tsx` — uniquement si le facteur doit transiter par les données d'arête plutôt que d'être lu directement par le composant d'arête.
- **Non touché** : la construction des arêtes et le calcul des extrémités (`trimToBorder`), la disposition des nœuds, `components/discover/ApplicationNode.tsx` et `InterfaceNode.tsx`, `lib/discoverMermaid.ts`, `components/discover/DiscoverExportMenu.tsx`, le catalogue, la carte et la fiche application.

## Edge Cases
- **Courbure à 0 %** : toutes les arêtes sont des segments droits ; deux arêtes entre les mêmes nœuds ne doivent pas se confondre en une seule ligne.
- **Arête très courte** (deux nœuds presque jointifs) : le plafond n'intervient pas, la courbure reste proportionnelle et discrète.
- **Arête très longue** (nœuds aux deux extrémités du canevas) : l'amplitude est bornée, le lien reste presque droit sur l'essentiel de son parcours.
- **Nœud déplacé pendant le réglage** : le tracé suit, sans état résiduel.
- **Zoom fort ou faible** : le galbe reste cohérent à l'écran, le plafond étant exprimé dans le repère du graphe.
- **Valeur persistée corrompue ou stockage indisponible** (navigation privée) : retour silencieux au défaut.
- **Graphe vide ou sans arête** : le curseur reste utilisable et sans effet visible.
- **Survol et sélection** à courbure nulle : l'atténuation et l'emphase restent lisibles sur des traits droits superposés.

## Open Questions
- **Séparation des arêtes parallèles à courbure nulle** : conserver un décalage minimal incompressible (les deux liens restent deux traits distincts même en mode « droit »), ou accepter qu'ils se superposent, la double flèche suffisant à signaler la réciprocité ? Recommandation : **décalage minimal incompressible** — deux relations distinctes ne doivent jamais se lire comme une seule. => suivre recommendation

- **Valeur du plafond** : quelle amplitude maximale en pixels ? Recommandation : **de l'ordre de 60 px**, à ajuster à l'œil sur un graphe réel d'une dizaine de nœuds.  => suivre recommendation

- **Graduation du curseur** : continu, ou par crans de 10 % ? Recommandation : **crans de 10 %**, plus faciles à reproduire et suffisamment fins.  => suivre recommendation

- **Intitulé de la section** dans le panneau : « Links », « Connections », « Edges » ? Recommandation : **« Links »**, cohérent avec le vocabulaire déjà employé dans Discover.  => suivre recommendation

- **Le réglage doit-il aussi s'appliquer au graphe étoile de la fiche application** ? Recommandation : **non** en V1 — ce graphe a sa propre logique de tracé radial, et le panneau de réglages n'existe pas sur cette vue.  => suivre recommendation

## Acceptance Criteria
- [ ] La courbure des arêtes est bornée : deux liens de longueurs très différentes présentent un galbe d'amplitude comparable, et aucun ne part en grande boucle au-dessus du graphe.
- [ ] Le panneau d'affichage de Discover expose un curseur de courbure, dans une section distincte des interrupteurs de contenu des cartes.
- [ ] À 0 %, toutes les arêtes sont des segments droits.
- [ ] À 0 %, deux arêtes entre les deux mêmes nœuds restent visuellement distinctes.
- [ ] Le déplacement du curseur retrace le graphe immédiatement, sans déplacer un seul nœud.
- [ ] Le réglage par défaut reproduit le rendu actuel, plafond inclus.
- [ ] Le réglage s'applique à la vue simplifiée comme à la vue interfaces.
- [ ] Le réglage est conservé après rechargement **et** après fermeture puis réouverture de l'onglet.
- [ ] Une valeur persistée invalide, ou un stockage indisponible, retombe sur le défaut sans erreur ni tracé cassé.
- [ ] Le curseur est utilisable au clavier et porte un libellé explicite ; la valeur courante est affichée.
- [ ] Le survol et la sélection continuent d'atténuer et de mettre en emphase les arêtes à toutes les valeurs de courbure.
- [ ] Aucune modification des exports (PNG, SVG, Mermaid), du graphe étoile, ni de la position des nœuds.
