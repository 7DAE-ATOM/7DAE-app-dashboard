# Feature Spec: Business Capabilities Colorées et Camembert sur les Applications Discover

## Summary

- Le chapitre **Business Capabilities** du panneau Highlight gagne la même case à cocher que le chapitre Data Object : n'afficher que les capacités **portées par une application visible** sur le diagramme.
- Cochée, elle allume un **code couleur** sur les capacités retenues : une pastille à droite du libellé dans l'arbre, qui sert de légende.
- Chaque rectangle d'application affiche alors, **sur son côté droit**, un **camembert** des capacités qu'elle couvre : une capacité, un disque d'une seule couleur ; deux capacités, deux parts ; et ainsi de suite.
- Le diagramme répond ainsi à « qui couvre quoi ? » sans qu'il faille ouvrir une fiche, et sans rien éteindre.

## Motivation

- La symétrie avec l'axe Data Object est le point de départ : les deux chapitres sont des jumeaux, et il serait incompréhensible que l'un sache se restreindre à ce qui est à l'écran et l'autre non.
- Mais les deux axes ne se lisent pas au même endroit, et c'est ce qui justifie une forme différente. Un data object **circule** : sa place est sur le flux. Une capacité est **portée** : sa place est sur l'application. Poser des pastilles de capacité sur les flèches n'aurait aucun sens ; un camembert sur le rectangle, si.
- La question « quelles applications couvrent la même capacité ? » n'a aujourd'hui de réponse qu'en cochant une capacité et en regardant ce qui reste allumé — une capacité à la fois. Le camembert répond pour toutes les capacités en même temps, et fait apparaître les recouvrements — deux rectangles qui portent la même couleur — sans aucune manipulation.
- Le chapitre liste aujourd'hui toute la hiérarchie LeanIX, dont l'immense majorité n'a rien à voir avec le diagramme affiché.

## Décisions (arbitrées)

### Cette fois, le critère est bien le compteur affiché

- Sur l'axe Data Object, la restriction portait sur les **interfaces** et divergeait donc du compteur, qui compte les applications : d'où un second dénombrement.
- Ici les deux coïncident exactement : le compteur compte déjà les **applications du diagramme** liées au nœud, et c'est précisément le critère demandé. La restriction est donc « garder les nœuds dont le compteur est non nul », sans rien calculer de nouveau.
- Et comme ce compteur est **remonté de bas en haut** (un parent compte les applications de toute sa descendance), l'ensemble obtenu contient déjà tous les ancêtres des nœuds retenus : l'arbre reste navigable sans traitement supplémentaire.

### Une pastille pour un lien direct, pas pour un cumul

- Un nœud n'est **coloré** que si une application visible le déclare **directement**. Un parent qui n'apparaît que parce que sa descendance compte reste sans pastille, comme les ancêtres conservés du chapitre Data Object.
- C'est la distinction que le compteur, lui, ne fait pas : il additionne. Colorier un parent sur la foi d'un cumul reviendrait à affirmer sur le camembert d'une application une capacité qu'elle ne porte pas.
- LeanIX autorise un lien vers un nœud non terminal : un parent **directement** lié à une application visible est donc, lui, retenu et coloré. Le critère est la nature du lien, pas la position dans l'arbre.

### Le camembert dit *lesquelles*, jamais *combien*

- Les parts sont **égales** : une capacité occupe la moitié d'un camembert à deux parts, un tiers d'un camembert à trois. Rien dans le modèle ne pondère la contribution d'une capacité à une application, et une part plus large se lirait immédiatement comme « plus important ».
- Une seule capacité donne donc un **disque plein** d'une seule couleur. C'est voulu : le camembert n'est pas un graphique, c'est une **signature colorée**.
- Au-delà d'un petit nombre de parts, le camembert devient illisible : le nombre de parts est **plafonné**, le reste réuni dans une part neutre, et la liste complète reste accessible au survol. Même règle que le plafond des pastilles sur les flux.

### Le camembert vit dans le rectangle, dans une colonne qui lui est réservée

- Il est posé **à l'intérieur** du rectangle, sur son bord droit, centré verticalement — pas accroché à l'extérieur, où il se confondrait avec un cercle d'interface.
- Il occupe une **colonne de largeur fixe**, et le texte (nom, External ID, manager) se resserre d'autant. Conséquence assumée : quand le code couleur est allumé, les noms longs se tronquent plus tôt. Superposer le camembert au texte serait pire — deux informations illisibles au lieu d'une.
- Son diamètre reste borné par la hauteur du rectangle et ne doit pas venir buter sur le bouton d'information, qui garde son coin bas-droit.
- Une application **sans** capacité connue n'affiche **rien** — pas de disque vide, qui se lirait comme une capacité inconnue plutôt que comme une absence.

### Le code couleur est solidaire de la case, et survit au repli du panneau

- Décocher la case rend exactement l'écran actuel : arbre complet, aucune pastille, aucun camembert.
- Comme pour les data objects, les couleurs restent visibles lorsque le panneau Highlight est replié, et réapparaissent seules après un rechargement. C'est le geste courant : replier le panneau pour regarder le diagramme.
- Les deux axes sont **indépendants** : on peut allumer les couleurs de capacités sans celles des data objects, et réciproquement.

### Deux familles de couleurs qui ne doivent pas se confondre

- Les deux axes puisent dans la même roue de teintes. Rien ne doit laisser croire qu'une capacité et un data object de la même couleur ont un rapport : ce sont deux vocabulaires distincts.
- La roue est donc **décalée** pour l'axe Capabilities, de sorte que les premiers arbres de chaque axe — ceux qu'on voit en pratique — ne tombent pas sur les mêmes teintes.
- La forme et l'emplacement font le reste du travail : un **disque sur un flux** est un data object, une **part de camembert dans un rectangle** est une capacité. Une collision de teinte lointaine reste possible et n'est pas une régression.

### Ce qui ne bouge pas

- Le compteur, sa règle et son libellé (« Counts are applications on the diagram »).
- Le mécanisme de mise en avant : cocher une capacité continue de faire exactement ce qu'il fait. La couleur ne dit pas ce qui est sélectionné, elle dit ce qui est couvert.
- Les vues Simple et Complex : les rectangles sont dessinés dans les deux, donc les camemberts aussi.

## Requirements

### Functional Requirements

#### La case à cocher

- Dans le chapitre **Business Capabilities**, au-dessus de l'arbre, à la même place et avec la même forme que celle du chapitre Data Object. Son libellé nomme les **applications visibles**.
- Décochée (défaut) : arbre complet, aucune pastille, aucun camembert — état actuel à l'identique.
- Cochée : arbre restreint, pastilles dans l'arbre, camemberts sur les rectangles.
- L'état est persisté et survit à un rechargement, indépendamment de celui de l'axe Data Object.

#### L'arbre restreint

- Sont affichés les nœuds dont le compteur d'applications du diagramme est non nul. Les chemins restent donc complets.
- Portent une pastille les seuls nœuds **directement** liés à au moins une application visible.
- Recherche, chevrons, cases et compteur fonctionnent inchangés sur l'arbre restreint.
- Aucune capacité couverte ⇒ l'arbre est vide et le dit, sans repli silencieux sur l'arbre complet.

#### Le camembert

- Une part par capacité **directement** portée par l'application et présente dans la hiérarchie chargée, dans la couleur de la légende.
- Parts égales, ordre stable d'une application à l'autre (deux applications portant les mêmes capacités montrent la même succession de couleurs).
- Au-delà du plafond, les capacités restantes sont réunies en une part neutre ; le survol donne leur liste.
- Le survol du camembert donne les noms des capacités représentées.
- Une application dont aucune capacité n'est connue — y compris une application absente du catalogue chargé, ramenée par un dépliage d'interface — n'affiche pas de camembert.
- Le camembert n'intercepte ni le glisser du rectangle, ni le clic qui déclenche la mise en avant.

#### Réactivité

- Ajouter ou retirer une application, déplier un voisinage, masquer un nœud : l'ensemble retenu, l'arbre, les pastilles et les camemberts suivent.
- Redimensionner un rectangle : le camembert garde sa taille et sa place sur le bord droit, le texte se réajuste.
- Basculer clair/sombre : les couleurs se réadaptent, en restant cohérentes entre l'arbre et les camemberts.
- Une mise en avant active atténue le camembert avec son rectangle.

### Non-Functional Requirements

- **Aucune requête supplémentaire** : les capacités des applications sont déjà chargées avec le catalogue, et la hiérarchie l'est déjà par le panneau.
- Le sens de circulation de l'information reste inchangé : le graphe publie ce que contient le canevas, le panneau s'y abonne, et les couleurs redescendent vers les nœuds par un store de module — jamais par une prop qui ferait re-rendre le graphe.
- Le camembert ne doit pas provoquer de re-mesure des nœuds par React Flow ni alourdir le glisser : sa géométrie ne dépend que des capacités de l'application, pas de la position du rectangle.
- Couleurs suivant les deux axes de thème ; classes Tailwind littérales ; composants clients.

## Scope

### In Scope

- La case à cocher du chapitre Business Capabilities, son libellé et sa persistance.
- La restriction de l'arbre et la règle « pastille seulement pour un lien direct ».
- L'attribution des couleurs sur l'axe Capabilities, décalée de celle de l'axe Data Object.
- Le camembert dans le rectangle : parts égales, plafond, part neutre, survol, place réservée.

### Out of Scope

- Pondérer les parts (par criticité, par coût, par nombre d'applications).
- Un camembert sur les **cercles d'interface** : ils ne portent pas cet axe.
- Colorier le **fond** ou la **bordure** du rectangle selon ses capacités.
- Une légende incrustée dans les exports PNG/SVG.
- Modifier le compteur existant, ou la restriction du chapitre Data Object.
- Toute écriture dans les filtres du catalogue ou de la carte.
- Déduire une capacité non déclarée (par voisinage, par héritage hiérarchique descendant).

## Affected Areas

- `components/discover/DiscoverHighlightPanel.tsx` — la seconde case, l'arbre restreint et la légende du chapitre Capabilities.
- `components/HierarchyTreeFilter.tsx` — réemploi tel quel des props `restrictTo` et `dots` ajoutées pour l'axe Data Object. Si ce composant doit encore changer, c'est un signe que le besoin a débordé.
- `components/discover/ApplicationNode.tsx` — la colonne réservée et le camembert ; le nœud sait déjà résoudre son application complète (`resolveApplication`, par le contexte d'info), donc ses capacités sont à portée.
- Un composant de camembert dédié, sans connaissance du graphe : des parts égales, des couleurs, un plafond.
- `lib/dataObjectColors.ts` — la règle de couleur est déjà générique sur un arbre hiérarchique ; c'est le décalage de roue entre les deux axes qui reste à exprimer.
- `lib/discoverDataObjectLegend.ts` et `components/discover/DataObjectColorsSync.tsx` — le couple « préférence persistée + nuancier publié + chargeur toujours monté » est exactement ce qu'il faut ici ; à réemployer pour le second axe plutôt qu'à copier.
- `lib/hierarchyTree.ts` — le dénombrement remonté existe ; il manque l'ensemble des nœuds **directement** liés, qui n'est aujourd'hui calculé nulle part.
- `lib/useBusinessCapabilityTree.ts` — chargement conditionnel, comme son jumeau côté data objects.

## Edge Cases

- **Canevas vide** : case cochée, arbre vide et message ; aucun camembert.
- **Application sans capacité** : pas de camembert, et le texte garde toute la largeur.
- **Application hors catalogue** : capacités inconnues, donc pas de camembert — le rectangle ne doit pas laisser croire à une couverture nulle.
- **Capacité portée par une application mais absente de la hiérarchie chargée** : ni pastille ni part, comme sur l'axe Data Object.
- **Parent directement lié à une application visible** : retenu et coloré, bien qu'il ait des enfants.
- **Parent présent par cumul seulement** : affiché, cochable, sans pastille.
- **Application à une seule capacité** : disque plein d'une seule couleur.
- **Application à beaucoup de capacités** : plafond et part neutre.
- **Rectangle réduit à sa largeur minimale** : le camembert garde sa place, le texte se tronque — il ne doit jamais être écrasé ni sortir du rectangle.
- **Les deux axes allumés en même temps** : pastilles sur les flux et camemberts dans les rectangles coexistent ; les vocabulaires se distinguent par la forme et l'emplacement.
- **Export PNG/SVG** : les camemberts y figurent ; leur légende, dans le panneau, non.
- **Sélection cochée devenue invisible** après restriction : elle continue d'agir sur la mise en avant ; le compteur de valeurs cochées du chapitre reste la seule trace.

## Open Questions

1. **Le plafond de parts** : même valeur que les pastilles de flux (6), ou plus bas ? Un camembert de 6 parts dans un disque de quelques dizaines de pixels est déjà très chargé. Proposition : **4**, puis une part neutre. => suivre recommendation

2. **Le diamètre du camembert** et donc la largeur prise au texte : à régler à l'œil sur un diagramme réel. Proposition de départ : un disque d'environ la moitié de la hauteur du rectangle.=> suivre recommendation

3. **Faut-il un anneau plutôt qu'un disque** ? Un anneau se distinguerait mieux d'une pastille de data object, mais lit moins bien en petit. Proposition : disque. => suivre recommendation

4. **Le cas d'une seule capacité** : disque plein d'une couleur, ou petit marqueur ? Proposition : disque plein, pour que toutes les applications se comparent sur la même forme. => suivre recommendation

## Acceptance Criteria

1. Le chapitre Business Capabilities affiche une case à cocher ; décochée, l'écran est strictement identique à l'actuel.
2. Cochée, l'arbre ne contient plus que les capacités couvertes par une application visible, chemins compris.
3. Un nœud directement lié à une application visible porte une pastille ; un nœud présent par cumul seulement n'en porte pas mais reste cochable.
4. Chaque rectangle d'application affiche sur son bord droit un camembert de ses capacités, aux couleurs de l'arbre.
5. Une application à une seule capacité affiche un disque d'une seule couleur ; à deux capacités, deux parts égales.
6. Deux applications portant la même capacité montrent la même couleur — le recouvrement se voit sans manipulation.
7. Au-delà du plafond, le camembert montre une part neutre et le survol donne les capacités restantes.
8. Une application sans capacité connue n'affiche aucun camembert.
9. Le texte du rectangle se resserre pour laisser sa place au camembert, sans jamais passer dessous.
10. Redimensionner un rectangle ou le déplacer ne déforme pas le camembert.
11. Les couleurs de capacités ne se confondent pas avec celles des data objects sur les premiers arbres de chaque axe.
12. Replier le panneau conserve pastilles et camemberts ; un rechargement les restitue seuls.
13. Cocher une capacité continue de mettre en avant exactement les mêmes éléments qu'avant cette fonctionnalité.
14. Basculer clair/sombre garde la correspondance exacte entre l'arbre et les camemberts.
15. Exporter en PNG et en SVG : les camemberts sont présents, aux mêmes couleurs.
16. `npx tsc --noEmit` et `npm run build` passent ; aucune erreur ni avertissement d'hydratation en console sur `/discover`.
