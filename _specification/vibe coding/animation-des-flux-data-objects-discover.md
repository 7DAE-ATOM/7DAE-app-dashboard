# Feature Spec: Animation des Flux de Data Objects dans Discover

## Summary

- Un nouvel icône dans la barre d'outils de `/discover`, **entre le bascule Simple/Complex et l'icône d'information**, active ou désactive une animation du diagramme.
- Actif, il met en mouvement les **pastilles de data objects** déjà posées sur les flèches : au lieu de rester au milieu du tracé, chaque pastille parcourt le flux en boucle infinie, de l'**interface vers l'application appelante** — c'est-à-dire à rebours de la pointe de flèche, qui exprime une dépendance et non une trajectoire.
- Le diagramme cesse d'être un schéma statique pour montrer que quelque chose **circule**, et quoi.
- L'état de l'icône est une préférence d'affichage persistée ; l'animation est **décochée par défaut**.

## Motivation

- Le code couleur répond à « quelles données circulent ici ? ». Il ne dit rien du **sens** ni du fait que ces flux sont vivants : une pastille immobile au milieu d'un trait se lit comme une étiquette, pas comme un transfert.
- Devant un diagramme projeté en réunion, le mouvement est ce qui fait comprendre en une seconde ce qu'une légende met une minute à expliquer. C'est l'usage visé.
- La flèche dit **qui dépend de qui**, jamais **où va la donnée** — et les deux vont en sens inverse. Une pastille qui descend du fournisseur vers son appelant montre le transport réel, information que le schéma statique ne porte nulle part aujourd'hui.
- Tout est déjà en place : les pastilles existent, leur géométrie suit la courbe, et les couleurs sont stables. Il ne manque que le déplacement.

## Décisions (arbitrées)

### Ce sont les mêmes pastilles, pas une seconde couche

- L'animation ne dessine **rien de nouveau**. Elle déplace les pastilles existantes : mêmes couleurs, même légende dans le panneau, même infobulle, même plafond et même marqueur « +N ».
- Conséquence directe : **sans pastilles, rien à animer**. L'animation n'a d'effet visible que lorsque la case « seulement ce qui circule » du chapitre Data Object est cochée, puisque c'est elle qui allume le code couleur.
- L'icône reste néanmoins **toujours actionnable**, et son infobulle dit ce qu'il faut cocher pour voir quelque chose. Le griser serait plus déroutant : un bouton inerte sans explication laisse croire à une panne, et la dépendance entre un bouton de la barre d'outils et une case au fond d'un panneau n'est pas devinable.

### Le sens : de l'interface vers l'application appelante

- La pastille part de l'**interface** et arrive à la **boîte applicative qui la consomme** (vue Complex), ou part de l'**application fournisseur** vers l'**application appelante** (vue Simple). Donc **à rebours de la pointe de flèche**.
- Ce n'est pas une incohérence, c'est la distinction que le diagramme ne savait pas encore exprimer : une flèche Discover dit « **consomme** », c'est une **dépendance**, pas une trajectoire. La donnée, elle, descend du fournisseur vers l'appelant. Faire suivre la flèche à l'animation reviendrait à affirmer que la donnée remonte vers son fournisseur, ce qui est faux.
- Les deux lectures coexistent donc sur le même trait, et c'est voulu : la **pointe** porte la dépendance, le **mouvement** porte le transport. C'est précisément ce que l'animation apporte de neuf — sans elle, le schéma ne dit que la moitié.
- À surveiller à l'usage : la pastille naît près de la pointe de flèche et s'en éloigne. Si cela se lit mal, le recours n'est pas d'inverser l'animation mais de revoir le marquage du lien.

### Vitesse constante, pas durée constante

- Le mouvement est réglé en **distance par seconde**, pas en durée par trajet. Deux liens de longueurs différentes doivent montrer la même vitesse ; une durée fixe ferait filer les liens longs et ramper les liens courts, ce qui se lirait comme une différence de débit inexistante.
- La vitesse est exprimée dans les **coordonnées du diagramme**, comme les pastilles elles-mêmes. Dézoomer ralentit donc le mouvement à l'écran dans la même proportion que tout le reste : c'est cohérent, et l'inverse donnerait l'impression que le diagramme s'emballe quand on prend du recul.
- Valeur de départ : une **constante unique**, à ajuster après l'avoir vue tourner. Elle ne sera **pas** exposée à l'utilisateur : pas de curseur dans le menu de l'engrenage, pas de réglage par diagramme.

### Un train, pas un peloton

- Plusieurs data objects sur une même flèche partent **décalés dans le temps**, régulièrement, et se suivent le long du tracé. L'écartement constant qui les sépare aujourd'hui au repos devient un décalage de phase.
- Sans ce décalage, toutes les pastilles d'une flèche partiraient ensemble et se superposeraient sur toute la longueur : on ne verrait qu'un point.

### Le mouvement ne passe pas par React

- L'animation doit être portée par le navigateur — animation déclarative sur les éléments déjà dessinés — et **jamais** par un état React rafraîchi image par image.
- Raison technique dure : recalculer une position par image ferait re-rendre les arêtes soixante fois par seconde et, pire, risquerait d'entraîner React Flow dans des re-mesures de nœuds. Toute la page Discover est construite pour éviter cela (la mise en avant est appliquée impérativement sur le DOM pour exactement cette raison).
- Conséquence : l'animation doit survivre à un déplacement de nœud, à un zoom et à un réglage de courbure sans être redémarrée à chaque image.

### Respect de `prefers-reduced-motion`

- Un mouvement en boucle infinie sur un écran entier est précisément ce que ce réglage système existe pour éviter.
- Lorsqu'il est actif, les pastilles **restent immobiles** à leur place habituelle, même si l'icône est activé. Aucune alerte, aucun message : l'utilisateur a déjà exprimé sa préférence au niveau du système.

### Le survol n'arrête rien

- Une pastille survolée continue sa course. Arrêter le convoi au survol ferait de chaque passage de souris sur le diagramme un à-coup visuel, pour un bénéfice — viser une infobulle — qui a déjà sa réponse : la légende du panneau, où les mêmes couleurs sont immobiles et nommées.
- À éprouver malgré tout : viser une cible mobile de cinq pixels peut se révéler pénible.

### Préférence persistée, décochée par défaut

- Rangée **avec les autres réglages d'affichage** (`lib/discoverDisplaySettings.ts`, qui porte déjà la courbure et les icônes d'information) plutôt que dans un store dédié : le bouton est leur voisin immédiat dans la barre d'outils et la nature de la préférence est identique.
- `localStorage`, comme eux, avec la validation explicite que ce store applique déjà champ par champ.
- Décochée par défaut : arriver sur un diagramme qui bouge tout seul sans l'avoir demandé serait une surprise, et l'usage courant de Discover reste l'exploration, pas la démonstration.

## Requirements

### Functional Requirements

#### L'icône

- Un bouton carré dans le bloc droit de la barre d'outils de `/discover`, **à droite du bascule Simple/Complex** et **à gauche de l'icône d'information**.
- Même gabarit, même bordure, même traitement actif/inactif que l'icône d'information voisine : rempli à l'accent quand l'animation est active, discret sinon.
- Un pictogramme au trait, dans la même famille que ses voisins, évoquant le mouvement le long d'un flux.
- Infobulle nommant **l'action** que le clic déclenche (et non l'état courant), avec la mention de ce qu'il faut activer pour voir des pastilles lorsque la légende est éteinte.
- État exposé aux technologies d'assistance (bouton à deux états).
- L'état survit à un rechargement de la page et suit les autres onglets ouverts, comme les autres préférences d'affichage.

#### Le mouvement

- Chaque pastille parcourt **le tracé réellement dessiné** : la courbe, depuis son extrémité côté interface (là où se trouve la pointe de flèche) jusqu'à son extrémité côté application appelante. Pas la corde, pas une ligne droite de centre à centre.
- Le cycle est **infini** : arrivée à l'extrémité, la pastille reparaît au départ.
- Plusieurs pastilles sur une même flèche se suivent à intervalle régulier.
- La vitesse est la même sur toutes les flèches du diagramme.
- Le marqueur de surcharge « +N » se déplace comme les autres, à sa place dans la file.

#### Ce qui ne change pas

- Couleurs, ordre, plafond, infobulles, légende du panneau : rien de tout cela ne dépend de l'animation.
- L'atténuation de la mise en avant continue de s'appliquer aux pastilles des flèches atténuées, en mouvement comme à l'arrêt.
- Désactiver l'animation remet les pastilles **au milieu du tracé**, exactement où elles sont aujourd'hui.
- Le bascule Simple/Complex, la courbure, le zoom, le déplacement des nœuds, l'ajout ou le retrait d'applications : tout continue de fonctionner pendant que l'animation tourne.

#### Interaction avec la courbure et les gestes

- La poignée de courbure d'une arête doit rester attrapable pendant l'animation ; une pastille qui passe sous le pointeur ne doit pas la faire disparaître ni voler le geste.
- Faire glisser la poignée pendant l'animation déforme le tracé, et les pastilles suivent la nouvelle courbe.

### Non-Functional Requirements

- **Aucun rendu React par image.** L'animation est déclarative et confiée au navigateur ; aucun minuteur applicatif, aucune boucle d'animation en JavaScript, aucun état mis à jour par image.
- **Aucune requête**, aucune donnée supplémentaire : tout ce qui est animé est déjà dessiné.
- Un diagramme chargé (plusieurs dizaines de flèches, plusieurs pastilles chacune) doit rester fluide et ne pas dégrader le glisser d'un nœud ni le zoom.
- L'animation ne doit pas empêcher la mise en avant impérative sur le DOM de fonctionner, ni être effacée par elle.
- Couleurs par tokens, classes littérales, composants clients ; `app/discover/page.tsx` reste un composant serveur.

## Scope

### In Scope

- L'icône, sa place dans la barre d'outils, son pictogramme, son infobulle et sa persistance.
- Le déplacement en boucle des pastilles le long du tracé, dans le sens de la flèche, dans les deux vues.
- Le décalage entre pastilles d'une même flèche.
- La prise en compte de `prefers-reduced-motion`.

### Out of Scope

- Animer autre chose que les pastilles : pulsation des nœuds, trait qui défile, flèche clignotante.
- Représenter un **débit** ou une **fréquence** réels : la vitesse est la même partout et ne signifie rien. L'information existe pourtant dans le modèle (`DiscoverEdge.frequency`) et ce serait une fonctionnalité à part entière, avec sa propre légende.
- Un réglage de vitesse par l'utilisateur : la constante est fixée dans le code, arbitrée une fois pour toutes.
- Suspendre le mouvement au survol d'une flèche ou d'une pastille.
- Animer le diagramme en l'absence de pastilles (flux sans data object connu, légende éteinte).
- Porter l'animation dans les exports Mermaid ou PDF.
- Mettre l'animation en pause quand l'onglet est en arrière-plan ou le diagramme hors écran.

## Affected Areas

- `components/DiscoverClient.tsx` — la barre d'outils et l'ordre de ses icônes.
- `components/discover/GraphEdge.tsx` — c'est là que les pastilles sont placées sur la courbe ; c'est donc là que le mouvement se joue.
- Un nouveau composant d'icône dans `components/icons/`, au trait, dans la famille des existants.
- Un nouveau composant de bascule dans `components/discover/`, sur le modèle exact de `DiscoverInfoIconsToggle` — il lit et écrit son store lui-même, rien en amont n'a besoin de le savoir.
- `lib/discoverDisplaySettings.ts` ou un store dédié, selon que l'animation est rangée avec les autres réglages d'affichage ou tenue à part.
- `app/globals.css` — si l'animation demande une déclaration de cycle réutilisable, c'est là qu'elle vit, à côté des classes de mise en avant du graphe.

## Edge Cases

- **Légende éteinte** : aucune pastille, donc aucun mouvement. L'icône reste actionnable et son infobulle l'explique.
- **Flèche sans data object connu** : rien ne s'y déplace, le trait reste nu.
- **Flèche très courte** (deux nœuds côte à côte) : les pastilles se resserrent déjà au repos ; en mouvement elles doivent rester sur le tracé et ne pas déborder sur les nœuds.
- **Courbure poussée à l'extrême** : la trajectoire reste la courbe dessinée.
- **Déplacement d'un nœud pendant l'animation** : le tracé change en continu ; le mouvement doit suivre sans repartir de zéro à chaque image.
- **Bascule Simple/Complex en cours d'animation** : les flèches sont reconstruites ; les pastilles repartent sur les nouveaux tracés.
- **Mise en avant active** : les pastilles des flèches atténuées s'atténuent, sans cesser de bouger.
- **`prefers-reduced-motion` actif** : pastilles immobiles, icône toujours actionnable et mémorisé.
- **Export PNG / SVG pendant que l'animation tourne** : l'image fige les pastilles quelque part sur leur trajet, pas au milieu du tracé comme à l'arrêt. Une pastille peut donc se retrouver collée à une boîte ou à une pointe de flèche. C'est acceptable, mais cela mérite d'être su : pour une image propre, désactiver l'animation avant d'exporter. Un export qui les figerait **toutes au départ** serait en revanche un défaut à corriger.
- **Onglet en arrière-plan puis retour** : le navigateur suspend et reprend seul ; aucun traitement particulier.

## Open Questions

Aucune. Les trois questions initiales ont été tranchées et remontées dans les décisions ci-dessus :

| Question | Réponse retenue |
| --- | --- |
| Vitesse réglable par l'utilisateur ? | Non : constante unique, fixée dans le code après l'avoir vue tourner. |
| Où ranger la préférence ? | Avec les autres réglages d'affichage (`lib/discoverDisplaySettings.ts`). |
| Arrêter le mouvement au survol ? | Non : le convoi continue, quitte à rendre l'infobulle plus difficile à viser. |

Le **sens** du mouvement, lui, a été corrigé après coup : il va de l'interface vers l'application appelante, à rebours de la pointe de flèche.

## Acceptance Criteria

1. La barre d'outils de `/discover` affiche un nouvel icône entre le bascule Simple/Complex et l'icône d'information, au même gabarit que ses voisins.
2. Cliquer dessus le passe en état actif (rempli à l'accent) et le fait ressortir ; l'état survit à un rechargement.
3. Légende de data objects active et animation active : chaque pastille se déplace le long de sa flèche, de l'interface vers la boîte applicative qui la consomme, en boucle — donc à rebours de la pointe de flèche.
4. Le mouvement suit la **courbe** dessinée, y compris après avoir tiré la poignée de courbure.
5. Deux flèches de longueurs très différentes montrent la **même vitesse** apparente.
6. Une flèche portant plusieurs pastilles les fait se suivre à intervalle régulier, sans qu'elles se superposent.
7. En vue Simple, les pastilles du flux replié se déplacent de l'application fournisseur vers l'application appelante.
8. Désactiver l'animation replace immédiatement les pastilles au milieu du tracé, sans rien changer d'autre.
9. Avec la légende éteinte, activer l'animation ne produit aucun mouvement et l'infobulle de l'icône explique ce qu'il faut cocher.
10. Déplacer un nœud, zoomer et recadrer pendant que l'animation tourne reste fluide ; le glisser ne saccade pas.
11. Une mise en avant active atténue les pastilles en mouvement des flèches atténuées.
12. La poignée de courbure d'une arête animée reste attrapable, y compris au moment où une pastille passe dessous.
13. Avec `prefers-reduced-motion` actif au niveau du système, aucune pastille ne bouge, l'icône restant actionnable et mémorisé.
14. `npx tsc --noEmit` et `npm run build` passent ; aucune erreur ni avertissement d'hydratation en console sur `/discover`.
