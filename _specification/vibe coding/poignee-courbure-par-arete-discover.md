# Feature Spec: Poignée de Courbure par Arête dans Discover

## Summary
- Permettre à l'utilisateur de **régler la courbure d'un lien en particulier**, à la souris, directement sur le graphe Discover.
- Au survol d'une arête, une **poignée** apparaît au milieu de sa courbe. L'utilisateur la saisit et la déplace : la courbure de cette arête suit le mouvement, en direct.
- Une arête ainsi ajustée **ignore le réglage global de courbure** (curseur « Links · Curvature » du panneau d'affichage, cf. `courbure-liens-parametrable-discover.md`). Un moyen explicite de revenir au comportement global est prévu.
- L'ajustement est un **réglage de session** : il vit tant que le graphe est ouvert, et n'est écrit ni dans le stockage du navigateur, ni dans le seed Discover, ni dans les exports. C'est le périmètre volontairement réduit de cette première version.
- Concerne les deux modes de vue de Discover (simplifiée et interfaces), qui partagent la même arête `graphEdge`.

## Motivation
- Le réglage global de courbure agit sur **toutes** les arêtes à la fois. Il règle le confort de lecture d'ensemble, mais pas le cas concret et fréquent : *une* arête qui passe au-dessus d'un nœud, ou deux arêtes qui se superposent à un endroit précis du schéma.
- Sur un graphe que l'on prépare pour une revue ou une capture d'écran, ces quelques collisions sont exactement ce qui fait la différence entre un schéma lisible et un schéma qu'il faut commenter à l'oral.
- Aucune disposition automatique ne résoudra ces cas à la place de l'utilisateur : la « bonne » courbure dépend de ce qu'il cherche à montrer. Lui donner la main sur une arête coûte peu et évite d'empiler les heuristiques.
- Les nœuds sont déjà déplaçables et redimensionnables à la souris dans Discover. Rendre les arêtes manipulables de la même façon est la suite logique, et ne demande pas d'apprendre un nouveau geste.

## Décisions (arbitrées)
- **Un seul geste, une seule affordance** : une poignée au survol, que l'on saisit et que l'on déplace. Pas de menu contextuel, pas de choix « droite / courbe » par arête, pas de poignées multiples.
- **Pas de persistance en V1.** L'ajustement disparaît au rechargement de la page. Le rendre durable ferait de la courbure une propriété du **diagramme** (donc à écrire dans le seed partagé et à répercuter dans les exports), alors que tout le reste du réglage de courbure est traité comme un confort de lecture propre à l'utilisateur. Ce basculement mérite d'être décidé après usage, pas avant.
- **L'ajustement manuel prime sur le réglage global.** Bouger le curseur global ne doit pas défaire un ajustement fait à la main ; sinon on ne comprend plus qui commande quoi.
- **Retour en arrière explicite** : un geste simple sur la poignée rend l'arête au réglage global.
- **L'amplitude est mémorisée en distance**, pas en proportion de la longueur du lien : si l'utilisateur déplace ensuite un nœud, le galbe garde l'amplitude réglée au lieu de gonfler avec la distance.

## Requirements

### Functional Requirements

#### Apparition de la poignée
- Au survol d'une arête, une poignée apparaît **au milieu de sa courbe** — pas au milieu du segment droit reliant les deux nœuds, sinon elle flotte à côté du trait sur les arêtes très courbées.
- La zone de survol est celle de l'arête elle-même, sans élargir le trait visible.
- La poignée reste affichée tant que le pointeur est **sur l'arête ou sur la poignée**. Le passage de l'une à l'autre ne doit pas la faire disparaître.
- Une seule poignée est visible à la fois. Sur un croisement d'arêtes, c'est celle de l'arête effectivement survolée.
- La poignée signale sa fonction : curseur de déplacement au survol, et retour visuel pendant la saisie.

#### Déplacement
- La saisie et le déplacement de la poignée modifient la courbure de l'arête **en direct**, sans validation.
- Seule la composante **perpendiculaire au lien** compte : déplacer la poignée le long de l'axe du lien ne change rien, la déplacer perpendiculairement creuse ou redresse la courbe, des deux côtés.
- Le geste doit fonctionner à tout niveau de zoom, la courbure suivant le pointeur à l'identique quelle que soit l'échelle.
- Pendant le déplacement, **le canevas ne doit ni se déplacer ni se zoomer**, et aucun nœud ne doit bouger ni être sélectionné.
- Le geste est annulable en cours (touche d'échappement), auquel cas l'arête retrouve la courbure qu'elle avait avant la saisie.
- Les extrémités du lien restent ancrées sur les bordures des deux nœuds ; seule la courbure change.

#### Articulation avec le réglage global
- Une arête ajustée à la main conserve son amplitude quand le curseur global change.
- Une arête jamais ajustée continue de suivre le réglage global, plafond compris.
- Un geste explicite sur la poignée (double-clic) rend l'arête au réglage global. Rien n'indique de façon permanente qu'une arête est ajustée — ce serait du bruit sur le schéma ; la découverte se fait au survol.
- Le **plancher de séparation des arêtes parallèles** (deux liens entre les mêmes nœuds ne doivent jamais se confondre) continue de s'appliquer aux arêtes non ajustées. Pour une arête ajustée, l'utilisateur est maître : s'il l'aplatit sur sa jumelle, c'est son choix.

#### Cycle de vie de l'ajustement
- L'ajustement suit l'arête tant qu'elle existe dans le graphe.
- Déplacer ou redimensionner un nœud ne remet pas l'ajustement à zéro : le galbe conserve son amplitude.
- Retirer une application du graphe, puis la rajouter, ne restaure pas les ajustements de ses anciennes arêtes.
- Basculer entre vue simplifiée et vue interfaces : les deux vues n'exposent pas les mêmes arêtes ; les ajustements faits dans l'une ne se transposent pas dans l'autre, mais ne doivent pas non plus être perdus si l'utilisateur revient à la première.
- Un rechargement de la page efface tous les ajustements.

### Non-Functional Requirements
- **Aucune dépendance nouvelle** : le moteur de graphe fournit déjà de quoi détecter le survol d'une arête et poser un élément à une position du repère graphe.
- **Fluidité** : le déplacement suit le pointeur sans à-coup sur un graphe de taille courante. Seule l'arête manipulée doit être retracée ; ni la disposition, ni les autres arêtes, ni les nœuds ne sont recalculés.
- **Aucun impact quand la fonctionnalité n'est pas utilisée** : pas de poignée affichée hors survol, pas de coût de rendu supplémentaire au repos.
- **Support pointeur** : souris en priorité ; le geste doit au minimum ne pas casser l'usage au pavé tactile. Le tactile n'est pas une cible de cette version.
- **Accessibilité** : la fonctionnalité est intrinsèquement à la souris ; elle ne doit retirer aucune capacité existante au clavier, et le réglage global reste le chemin accessible pour agir sur la courbure.

## Scope

### In Scope
- Détection du survol d'une arête et affichage d'une poignée au milieu de sa courbe.
- Saisie et déplacement de la poignée, avec mise à jour en direct de la courbure de cette seule arête.
- Mémorisation en session de l'ajustement, par arête.
- Priorité de l'ajustement manuel sur le réglage global, et retour au global par double-clic.
- Neutralisation du déplacement du canevas pendant la saisie.

### Out of Scope
- **Toute persistance** : stockage navigateur, seed Discover partagé, URL.
- **Exports** (PNG, SVG, Mermaid) — inchangés.
- **Correction de l'ancrage** des extrémités (tangentes perpendiculaires à la bordure des nœuds) : c'est une itération séparée, indépendante de celle-ci.
- **Tracés orthogonaux** ou changement de type de courbe par arête.
- Déplacement des **extrémités** d'un lien (changer le point d'attache sur le nœud).
- Poignées multiples, courbes à plusieurs inflexions, béziers cubiques.
- Support tactile et gestes multipoints.
- Toute action par arête autre que la courbure (couleur, épaisseur, suppression, étiquette).
- Le graphe étoile de la fiche application et `/depgraph`.

## Affected Areas
- **Modifier** :
  - `components/discover/GraphEdge.tsx` — état de survol, poignée, gestion du geste, prise en compte d'un écart propre à l'arête en lieu et place du calcul global.
  - `components/discover/DiscoverGraph.tsx` — table des ajustements par arête (état de session) et transmission aux arêtes.
- **Non touché** : `lib/discoverDisplaySettings.ts` (le réglage global et sa persistance ne bougent pas), le calcul des extrémités et la disposition des nœuds, `ApplicationNode` / `InterfaceNode`, `lib/discoverMermaid.ts`, `DiscoverExportMenu.tsx`, `components/StarGraph.tsx`, le catalogue, la carte et la fiche application.

## Edge Cases
- **Arête très courte** : la poignée ne doit pas recouvrir les deux nœuds ni devenir insaisissable.
- **Arête très longue** : la poignée reste au milieu de la courbe, donc atteignable sans traverser tout le canevas.
- **Zoom très faible** : la poignée doit rester saisissable et ne pas devenir un point d'un pixel ; zoom très fort : elle ne doit pas masquer le schéma.
- **Deux arêtes parallèles** : survoler l'une ne doit pas afficher la poignée de l'autre ; une fois l'une ajustée, l'autre continue de suivre le réglage global.
- **Croisement d'arêtes** : la poignée affichée est celle de l'arête réellement sous le pointeur.
- **Nœud déplacé après ajustement** : la courbe suit, en gardant son amplitude.
- **Nœud déplacé de l'autre côté du lien** (la géométrie s'inverse) : la courbe ne doit pas se retourner brutalement de façon incompréhensible.
- **Pointeur relâché hors du canevas** : le geste se termine proprement, la dernière valeur est conservée, aucun état de saisie ne reste actif.
- **Aplatissement complet** : l'utilisateur peut ramener une arête ajustée à un segment parfaitement droit.
- **Changement de mode de vue pendant un survol** : la poignée disparaît sans laisser d'état résiduel.
- **Suppression d'une application** dont une arête était ajustée : aucun ajustement orphelin ne doit subsister.

## Open Questions
- **Taille de la poignée au zoom** : la laisser suivre l'échelle du graphe (elle grossit et rétrécit avec le zoom), ou la maintenir à taille constante à l'écran ? Recommandation : **taille constante à l'écran** — c'est une commande d'interface, pas un élément du schéma. => suivre recommendation

- **Forme de la poignée** : simple pastille pleine, ou pictogramme évoquant le déplacement ? Recommandation : **pastille discrète** aux couleurs de l'accent, la fonction se découvrant au curseur et au mouvement ; un pictogramme à cette taille serait illisible.  => suivre recommendation

- **Retour au réglage global** : double-clic sur la poignée (proposé), ou passage par un menu ? Recommandation : **double-clic**, cohérent avec le reste de l'application et sans surface d'interface supplémentaire.  => suivre recommendation

- **Délai de disparition** au sortir de l'arête : disparition immédiate, ou court sursis pour laisser le temps d'atteindre la poignée ? Recommandation : **un court sursis**, sinon le geste devient frustrant sur les arêtes fines.  => suivre recommendation

- **Conservation des ajustements entre les deux modes de vue** : les garder en mémoire pour un aller-retour, ou repartir de zéro à chaque bascule ? Recommandation : **les garder** — l'utilisateur ne s'attend pas à perdre son travail en changeant de vue puis en revenant.  => suivre recommendation

- **Indicateur d'arête ajustée** : faut-il malgré tout un signe discret pour retrouver les arêtes réglées à la main ? Recommandation : **non** en V1, à réévaluer si les utilisateurs perdent la trace de leurs ajustements.  => suivre recommendation

## Acceptance Criteria
- [ ] Survoler une arête fait apparaître une poignée au milieu de **sa courbe**, y compris sur une arête fortement incurvée.
- [ ] La poignée reste affichée quand le pointeur passe de l'arête à la poignée.
- [ ] Saisir et déplacer la poignée modifie la courbure de cette seule arête, en direct.
- [ ] Le déplacement perpendiculaire au lien creuse ou redresse la courbe des deux côtés ; le déplacement dans l'axe du lien n'a pas d'effet.
- [ ] Pendant la saisie, le canevas ne se déplace pas, ne zoome pas, et aucun nœud n'est déplacé ni sélectionné.
- [ ] Une arête ajustée conserve son amplitude quand le curseur global de courbure change.
- [ ] Une arête jamais ajustée continue de suivre le réglage global, plafond inclus.
- [ ] Un double-clic sur la poignée rend l'arête au réglage global.
- [ ] L'utilisateur peut aplatir une arête ajustée jusqu'au segment parfaitement droit.
- [ ] Déplacer un nœud conserve l'amplitude réglée à la main.
- [ ] Le geste fonctionne identiquement à différents niveaux de zoom.
- [ ] Relâcher le pointeur hors du canevas termine le geste proprement.
- [ ] Un rechargement de la page efface les ajustements, sans erreur ni état résiduel.
- [ ] La fonctionnalité est disponible dans les deux modes de vue de Discover.
- [ ] Aucune dépendance ajoutée ; exports, seed Discover, graphe étoile et réglage global persistant restent inchangés.
