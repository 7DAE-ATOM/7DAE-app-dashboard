# Feature Spec: Data Objects Colorés sur les Flux du Diagramme Discover

## Summary

- Le diagramme Discover montre **qui** échange avec **qui**, jamais **quoi**. Cette fonctionnalité pose sur chaque flèche une **pastille de couleur par data object transporté** — c'est-à-dire par data object lié à l'interface que cette flèche vise.
- Le chapitre **Data Object** du panneau Highlight gagne une case à cocher : « tous les data objects » (comportement actuel) ou « seulement ceux transportés par une interface visible sur le diagramme ».
- Cochée, cette case allume le **code couleur** : chaque data object retenu reçoit une couleur, affichée en pastille à droite de son libellé dans l'arbre et reprise à l'identique sur toutes les flèches concernées. L'arbre devient ainsi la **légende** du diagramme.
- Les couleurs suivent la hiérarchie : une même teinte par arbre, du plus sombre (racine) au plus clair (feuille).

## Motivation

- L'information existe déjà dans le modèle (`DiscoverInterfaceNode.dataObjects`) et est déjà chargée, mais elle n'est lisible qu'en ouvrant les fiches d'interface une par une. Devant un diagramme de quelques dizaines de flux, personne ne le fait.
- Le panneau Highlight répond à « **par où** passe telle donnée ? » — une donnée à la fois, en éteignant le reste. Il ne répond pas à « qu'est-ce qui circule **ici** ? », ni à « quelles données circulent sur ce périmètre ? ». La pastille répond aux deux d'un seul coup d'œil, sans rien éteindre.
- Le chapitre Data Object liste aujourd'hui **toute** la hiérarchie LeanIX, y compris les centaines de nœuds qui n'ont aucun rapport avec le diagramme à l'écran. Restreindre la liste à ce qui circule réellement transforme un arbre de référence en inventaire de ce qu'on regarde.
- Les deux morceaux se tiennent : sans la restriction, il faudrait colorier une hiérarchie entière et le code couleur serait illisible ; sans le code couleur, la restriction ne serait qu'un filtre d'arbre de plus.

## Décisions (arbitrées)

### Le critère de restriction n'est pas le compteur actuel

- Le compteur affiché sur chaque nœud de l'arbre compte aujourd'hui les **applications du diagramme** liées à ce data object (`countApplicationsPerDataObject`). Ce n'est **pas** le critère demandé ici, qui porte sur les **interfaces visibles**, explicitement à l'exclusion du lien application → data object.
- Les deux ensembles ne coïncident pas, et pas par accident : le modèle LeanIX porte les deux relations séparément, et le panneau Highlight documente déjà qu'elles divergent (une interface peut transporter une donnée que ni l'application émettrice ni la réceptrice ne déclarent). Un data object peut donc afficher un compteur à 0 tout en étant transporté par une interface visible, et l'inverse.
- Il faut donc un **second dénombrement**, sur les interfaces du canevas, qui sert à la fois de critère de restriction et de vérité pour le code couleur. Le compteur « applications » affiché reste inchangé — le changer silencieusement ferait mentir l'unité annoncée dans le chapitre (« Counts are applications on the diagram »).

### Restreindre l'affichage, pas l'arbre

- Case cochée, l'arbre ne montre que les data objects transportés par une interface visible **et tous leurs ancêtres**, sans quoi les nœuds retenus n'auraient plus de chemin et l'arborescence deviendrait une liste plate sans contexte.
- Un ancêtre conservé pour cette seule raison reste cochable — cocher un parent vaut pour sa descendance, règle inchangée.
- Rien n'est retiré du **modèle** ni du **canevas** : c'est un affichage de l'arbre, pas un filtre du diagramme.

### Le code couleur est solidaire de la case

- Décocher la case rend exactement l'état actuel : arbre complet, aucune pastille nulle part. C'est un seul geste, un seul mode.
- La couleur est indépendante des **cases à cocher** du chapitre : elle ne dit pas ce qui est sélectionné, elle dit ce qui circule. Les deux mécanismes se superposent sans se gêner (voir « Cohabitation »).
- La case est une préférence d'affichage : persistée en `localStorage` via `lib/createPersistedStore.ts`, conformément à CLAUDE.md. Défaut : **décochée**, pour que l'écran actuel ne change pas sans qu'on le demande.

### Des couleurs stables, pas tirées au sort à chaque rendu

- « Aléatoire » est retenu au sens « aucune sémantique, pas de palette métier à respecter » — pas au sens « différent à chaque fois ». La couleur est **entièrement déterminée** par la place du data object dans la hiérarchie et par les familles présentes sur le diagramme : elle est donc **la même d'un rendu à l'autre, d'une session à l'autre, et entre l'arbre et les flèches**.
- Un tirage réel serait redistribué à **chaque** ajout de nœud : la légende changerait sous les yeux de l'utilisateur au moindre dépliage de voisinage, et deux captures du même diagramme ne seraient pas comparables. La règle retenue ne bouge que lorsqu'une famille de premier niveau entre ou sort du diagramme (voir plus bas).

### La hiérarchie donne le nuancier

- La **teinte** vient de l'ancêtre de plus haut niveau : tous les data objects d'un même arbre partagent une couleur.
- Les teintes des différents arbres sont prises sur une **roue de huit couleurs régulièrement espacées** (45° au minimum entre deux arbres), et non tirées d'un hachage ni d'une liste choisie à la main. Deux tentatives ont échoué à l'essai : un hachage répartit bien *en moyenne*, ce qui ne dit rien de la poignée de valeurs affichées côte à côte ; une roue de douze teintes nommées contenait quatre verts, dont deux à 22° l'un de l'autre.
- Les arbres **présents sur le diagramme prennent le début de la roue**, les autres suivent. C'est ce qui rend la garantie tenable : ranger les racines par leur rang dans la hiérarchie complète ne protège rien, puisque celles qu'on affiche en sont une poignée arbitraire — deux racines distantes d'un multiple de la longueur de roue tombaient sur la même entrée, pendant que l'ambre et l'orange restaient inutilisés.
- Contrepartie assumée : la teinte d'un arbre dépend des arbres présents. Elle change quand une **famille de premier niveau** apparaît ou disparaît du diagramme, jamais quand on ajoute un nœud dans une famille déjà là. Une couleur que personne ne distingue est stable et inutile.
- La **luminosité** vient de la profondeur : sombre à la racine, clair à la feuille.
- Deux feuilles sœurs se retrouvent donc à la même profondeur dans la même teinte. Elles sont séparées autant que la place le permet, mais la discrimination à l'œil a une limite : au-delà de quelques nœuds par niveau, seules la **pastille survolée** (infobulle portant le nom) et la légende de l'arbre tranchent. C'est assumé — un code couleur globalement distinct sur une hiérarchie de plusieurs centaines de nœuds n'existe pas.
- Les couleurs sont produites dans une plage de luminosité **adaptée au thème actif** : ce qui est lisible sur fond sombre ne l'est pas sur fond clair. Elles suivent donc le basculement clair/sombre.

### Où se posent les pastilles

- **Vue Complex** : une flèche va d'une application consommatrice vers un cercle d'interface. Elle porte les pastilles des data objects de **cette** interface. Deux consommateurs de la même interface portent donc les mêmes pastilles — c'est la même donnée qui circule deux fois.
- **Vue Simple** : les interfaces ne sont pas dessinées et les flux sont repliés en `consommateur → fournisseur`. La flèche repliée porte l'**union** des data objects de toutes les interfaces qu'elle replie. C'est la seule lecture cohérente avec ce que l'écran montre.
- Position : **centrée sur la longueur de la flèche**, sur le milieu de la **courbe** et non de la corde — les liens sont des courbes de Bézier dont la courbure est réglable, globalement et par arête.
- Plusieurs pastilles sur une même flèche sont **décalées régulièrement de part et d'autre du milieu**, sans jamais se chevaucher, et restent sur le tracé.

### Trop de pastilles sur une flèche

- Au-delà d'un petit nombre, une file de pastilles cesse d'être lisible et déborde sur les nœuds voisins.
- Le nombre affiché est donc **plafonné**, le dépassement signalé par un marqueur de surcharge explicite (« +N »), et la liste complète reste accessible au survol. Tronquer sans le dire ferait croire que le reste ne circule pas.

### Contenu, pas commande

- Les pastilles font partie du diagramme : elles **suivent le zoom** comme les nœuds et les liens, contrairement à la poignée de courbure qui est une commande et garde sa taille à l'écran.
- Conséquence voulue : elles apparaissent dans les exports **PNG** et **SVG**, qui capturent le rendu. L'export **Mermaid**, qui reconstruit à partir du modèle, ne les porte pas.

### Cohabitation avec la mise en avant

- La mise en avant (clic sur un nœud, ou sélection du panneau) atténue les éléments non retenus. Une pastille posée sur une flèche atténuée **s'atténue avec elle** : elle appartient à la flèche, pas à une couche au-dessus.
- Cocher un data object dans l'arbre continue de faire exactement ce qu'il fait aujourd'hui. La couleur n'ajoute ni ne retire rien à cette règle.

## Requirements

### Functional Requirements

#### La case à cocher

- Une case à cocher dans le chapitre **Data Object** du panneau Highlight, au-dessus de l'arbre, libellée sans ambiguïté sur le fait qu'elle porte sur les **interfaces visibles** et non sur les applications.
- Décochée (défaut) : arbre complet, aucune pastille — état actuel à l'identique.
- Cochée : arbre restreint aux data objects transportés par une interface visible du diagramme, ancêtres conservés, code couleur actif dans l'arbre et sur les flèches.
- L'état de la case est persisté et survit à un rechargement.
- La case est dans le chapitre Data Object uniquement. Le chapitre Business Capabilities n'est pas concerné.

#### Ce que « transporté par une interface visible » veut dire

- **Interface visible** = interface effectivement dessinée sur le canevas en vue Complex. En vue Simple, les cercles ne sont pas dessinés mais les flux qu'ils portent le sont : l'ensemble retenu est **le même dans les deux vues**, sinon basculer de vue viderait la légende d'un diagramme dont les flux n'ont pas changé.
- La relation utilisée est celle de l'**interface** (`DiscoverInterfaceNode.dataObjects`). La relation application → data object n'entre pas dans ce calcul.
- Un data object transporté est retenu **tel quel** : cocher son parent n'est pas requis, et un parent n'est pas retenu du seul fait qu'un descendant l'est — il est conservé comme ancêtre, ce qui est différent (voir ci-dessous).
- Un data object porté par une interface mais **absent de la hiérarchie chargée** n'a ni place dans l'arbre ni couleur ; il ne doit pas faire échouer le reste.

#### L'arbre restreint

- Un nœud est montré s'il est retenu, ou s'il est l'**ancêtre** d'un nœud retenu.
- Un ancêtre conservé est visuellement distinguable d'un nœud retenu : il ne porte **pas** de pastille, puisque rien ne le transporte lui-même.
- La recherche textuelle, les chevrons, les cases à cocher et le compteur « applications » fonctionnent inchangés sur l'arbre restreint.
- Aucun data object transporté ⇒ l'arbre est vide et le dit (« Aucun data object ne circule sur ce diagramme »), sans se rabattre silencieusement sur l'arbre complet.

#### Les pastilles dans l'arbre

- Une pastille ronde, à droite du libellé, de la couleur attribuée au data object. Elle cohabite avec le compteur déjà présent à droite.
- Sa seule fonction est d'être la **légende** des pastilles du diagramme : même couleur, même donnée.

#### Les pastilles sur les flèches

- Une pastille par data object transporté, dans la couleur de la légende, posée sur le tracé de la flèche et centrée sur sa longueur.
- Plusieurs pastilles se répartissent autour de ce centre sans chevauchement.
- Le survol d'une pastille donne le **nom** du data object.
- Les pastilles ne doivent pas capter les gestes du canevas ni gêner la poignée de courbure de l'arête : c'est le tracé qui reste la cible de la courbure.
- Une flèche dont l'interface ne transporte aucun data object ne porte aucune pastille et n'est pas modifiée.
- Un data object transporté mais absent de la hiérarchie chargée n'est pas dessiné (pas de pastille sans légende possible).

#### Réactivité

- Ajouter ou retirer une application, déplier un voisinage, révéler ou masquer une interface : l'ensemble retenu, l'arbre et les pastilles suivent.
- Basculer Simple/Complex : les pastilles se recomposent (une par interface, ou l'union sur le flux replié), la légende ne bouge pas.
- Déplacer un nœud, zoomer, recadrer, régler la courbure : les pastilles suivent la géométrie mais **l'ensemble retenu ne se recalcule pas** — rien de tout cela ne change ce qui circule.
- Basculer clair/sombre : les couleurs se réadaptent, en restant cohérentes entre l'arbre et les flèches.

### Non-Functional Requirements

- **Aucune requête supplémentaire** : les data objects des interfaces sont déjà chargés avec le graphe, et la hiérarchie l'est déjà par le panneau. Cette fonctionnalité n'interroge rien.
- **Le sens de circulation de l'information est inchangé** : le graphe publie ce que contient le canevas, le panneau s'y abonne. L'abonnement du panneau ne doit jamais provoquer un rendu du graphe — c'est ce qui protège la technique de mise en avant impérative sur le DOM.
- Le canevas publie aujourd'hui les data objects de chaque interface (`CanvasInterface.dataObjectIds`) ; la signature qui garde l'identité du snapshot stable doit continuer à ne changer que quand le contenu change réellement.
- Déplacer un nœud recalcule déjà la géométrie des arêtes ; y ajouter les pastilles ne doit pas y ajouter de travail proportionnel à la hiérarchie. La couleur d'un data object se calcule une fois, pas par arête et par image.
- Couleurs exprimées par tokens ou dérivées de façon à suivre les deux axes de thème ; classes Tailwind littérales.
- Composants clients ; `app/discover/page.tsx` reste un composant serveur.

## Scope

### In Scope

- La case à cocher, sa persistance et son libellé.
- Le dénombrement des data objects par **interface visible**, distinct du compteur d'applications existant.
- La restriction de l'arbre et la conservation des ancêtres.
- L'attribution des couleurs (teinte par arbre, luminosité par profondeur, dérivée de l'id, adaptée au thème).
- Les pastilles dans l'arbre et sur les flèches, dans les deux vues, avec plafond et marqueur de surcharge.

### Out of Scope

- Toute modification du compteur « applications » existant, de sa règle ou de son libellé.
- Colorier les **nœuds** (rectangles d'application, cercles d'interface) selon leurs data objects.
- Une restriction équivalente sur le chapitre **Business Capabilities**, ou sur le filtre Data Object du **catalogue** — le panneau Discover n'écrit jamais dans `lib/appFilters.ts`.
- Choisir ou éditer les couleurs, les fixer par data object, ou les persister.
- Étiqueter les flèches avec les **noms** des data objects (texte sur le tracé) : illisible dès trois flux.
- Porter les pastilles dans l'export **Mermaid** ou dans l'export **PDF**.
- Déduire un transport non présent dans le modèle (remonter d'une application vers les données de ses interfaces, ou l'inverse).

## Affected Areas

- `components/discover/DiscoverHighlightPanel.tsx` — la case, l'arbre restreint, la légende ; c'est lui qui connaît à la fois la hiérarchie et le contenu du canevas.
- `components/HierarchyTreeFilter.tsx` — doit savoir montrer un sous-ensemble de nœuds et une pastille par nœud. Premier élargissement de ce composant depuis sa généralisation ; l'ajout doit rester exprimé par le **caller**, qui est le seul à savoir de quoi il parle.
- `components/discover/GraphEdge.tsx` — le tracé, sa géométrie et donc le point milieu de la courbe : c'est là que se posent les pastilles.
- `components/discover/DiscoverGraph.tsx` — le mémo `edges` (les deux branches, Simple et Complex) est le seul endroit qui sait quelle interface une flèche vise, et ce que replie un flux simplifié.
- `lib/discoverCanvasContents.ts` — `CanvasInterface.dataObjectIds` est déjà la source ; à confirmer suffisante.
- `lib/dataObjects.ts` / `lib/hierarchyTree.ts` — dénombrement par interface et conservation des ancêtres, à côté du dénombrement par application existant.
- `lib/createPersistedStore.ts` — pour la seule préférence de la case.
- `lib/useTheme.ts` — la plage de luminosité dépend du thème actif.
- Un module dédié à l'attribution des couleurs, sans dépendance au rendu : c'est la règle que l'arbre et les flèches doivent partager, et deux copies divergeraient au premier ajustement.

## Edge Cases

- **Canevas vide** : case cochée, l'arbre est vide et l'explique.
- **Aucune interface dépliée** : même cas — les flux n'existent pas encore, rien ne circule.
- **Data object transporté par une interface visible mais dont aucune application affichée ne se réclame** : retenu, coloré, avec un compteur « applications » à 0. C'est le cas normal, et c'est précisément ce que la restriction rend visible.
- **Data object lié à des applications mais à aucune interface visible** : disparaît de l'arbre case cochée, bien que son compteur soit > 0. À dire dans le libellé de la case, sans quoi sa disparition passe pour un bug.
- **Interface sans data object** : ses flèches restent nues.
- **Interface transportant beaucoup de data objects** : plafond et marqueur de surcharge.
- **Deux consommateurs de la même interface** : deux flèches, mêmes pastilles. Ce n'est pas une duplication à corriger.
- **Vue Simple, deux applications reliées par plusieurs interfaces** : une flèche, union des data objects, chaque couleur une seule fois.
- **Flèche très courte** (deux nœuds côte à côte) : les pastilles ne doivent pas déborder au-delà des extrémités du tracé ; au besoin elles se resserrent ou passent sous le plafond.
- **Forte courbure manuelle** : les pastilles restent sur la courbe, pas sur la corde.
- **Zoom très arrière** : les pastilles rétrécissent avec le diagramme, jusqu'à devenir de simples points — acceptable, c'est du contenu.
- **Hiérarchie non chargée ou en erreur** : la case reste sans effet visible et le chapitre garde son message d'erreur ; aucune pastille sur le diagramme, puisqu'aucune légende ne peut leur correspondre.
- **Une sélection cochée devient invisible** après restriction : elle continue d'agir sur la mise en avant. Le canevas resterait atténué sans explication visible dans l'arbre — le compteur de valeurs cochées du chapitre reste la seule trace, et doit suffire.
- **Export PNG/SVG** : les pastilles y figurent. Leur légende, elle, vit dans le panneau et **n'y figure pas** — une image exportée montre des couleurs dont la clé reste à l'écran.

## Open Questions

1. **Le plafond de pastilles par flèche** : quelle valeur ? Proposition : 6, puis « +N ». À confirmer à l'usage, sur un diagramme réel. => suivre recommendation

2. **Les data objects transportés mais absents de la hiérarchie chargée** doivent-ils apparaître quelque part (nœud « Hors hiérarchie » en fin d'arbre) ou rester invisibles, comme proposé ici ? => impossible, donc pas d'affichage prévu

3. **La légende dans l'export** : faut-il, dans un second temps, incruster une légende des couleurs présentes dans l'image PNG/SVG ? Hors périmètre ici, mais l'image est aujourd'hui incomplète sans elle. => non pas pour l'instant

4. **Un ancêtre conservé** doit-il rester **cochable** (proposé) ou devenir un simple intitulé de chemin ? => oui cochable

## Acceptance Criteria

1. Le chapitre Data Object du panneau Highlight affiche une case à cocher ; décochée, l'écran est strictement identique à l'actuel — arbre complet, aucune pastille.
2. Cochée, l'arbre ne contient plus que les data objects transportés par une interface visible du diagramme, et leurs ancêtres.
3. Un data object lié à des applications du diagramme mais à aucune interface visible **disparaît** de l'arbre, même si son compteur est > 0.
4. Un data object transporté par une interface visible **apparaît**, même si son compteur d'applications vaut 0.
5. Chaque data object retenu porte une pastille de couleur à droite de son libellé ; les ancêtres conservés n'en portent pas.
6. Deux data objects du même arbre hiérarchique portent la même teinte, le parent plus sombre que ses descendants.
7. La couleur d'un data object est la même après un rechargement de la page et après un ajout de nœud sur le canevas.
8. En vue Complex, chaque flèche porte, au milieu de son tracé, une pastille par data object de l'interface qu'elle vise, dans les couleurs de la légende.
9. Une interface transportant plusieurs data objects produit des pastilles décalées, sans chevauchement.
10. En vue Simple, une flèche repliant plusieurs interfaces porte l'union de leurs data objects, chaque couleur une seule fois.
11. Le survol d'une pastille donne le nom du data object.
12. Au-delà du plafond, la flèche affiche le marqueur de surcharge et la liste complète reste consultable au survol.
13. Modifier la courbure d'une arête déplace ses pastilles avec le tracé ; elles restent sur la courbe.
14. Basculer clair/sombre garde la correspondance exacte entre les pastilles de l'arbre et celles des flèches.
15. Une mise en avant active atténue les pastilles des flèches atténuées, en même temps qu'elles.
16. Exporter en PNG puis en SVG : les pastilles sont présentes, aux mêmes couleurs et aux mêmes positions qu'à l'écran.
17. Les filtres du catalogue et de la carte sont inchangés après usage de la case.
18. `npx tsc --noEmit` et `npm run build` passent ; aucune erreur ni avertissement d'hydratation en console sur `/discover`.
