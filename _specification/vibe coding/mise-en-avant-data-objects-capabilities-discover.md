# Feature Spec: Mise en Avant des Data Objects et Business Capabilities dans Discover

## Summary

La page Discover dessine aujourd'hui un graphe d'applications et d'interfaces sans grille de lecture fonctionnelle : on voit *qui* échange avec *qui*, jamais *quoi* ni *pour quoi faire*. Cette fonctionnalité ajoute un panneau escamotable sur le bord gauche du canevas, contenant deux chapitres — **Data Object** et **Business Capabilities** — identiques à ceux du filtre du catalogue. Cocher des valeurs n'ajoute ni ne retire aucun nœud : cela **met en avant** les éléments du schéma qui portent ces valeurs, en atténuant tous les autres, exactement comme le fait déjà un clic sur un nœud.

Un sélecteur de mode de jointure (OU / ET) placé en haut du panneau décide de la façon dont plusieurs valeurs cochées se combinent.

## Motivation

Deux questions reviennent devant un schéma Discover un peu dense et n'ont aujourd'hui aucune réponse visuelle :

- « Par où passe telle donnée ? » — l'information existe (`DiscoverInterfaceNode.dataObjects` : ce qui transite par chaque interface) mais n'est lisible qu'en ouvrant les fiches une par une.
- « Qui couvre telle capacité métier ? » — l'information existe aussi (`Application.businessCapabilities`) et n'est visible nulle part sur le canevas.

Le mécanisme de mise en avant au clic prouve déjà que l'atténuation du reste du graphe est une lecture efficace. Il s'agit de le déclencher depuis un axe fonctionnel plutôt que depuis un nœud.

Le choix de **ne pas filtrer** (au sens « masquer ») est délibéré : dans Discover, retirer un nœud casse les chemins et donc la compréhension du flux. La mise en avant conserve le contexte.

## Décisions (arbitrées)

- **Mise en avant, pas filtrage.** Aucun nœud n'est ajouté ni retiré du canevas.
- **Rendu identique au clic.** Le même couple de classes `.rf-dim` / `.rf-emph` (`app/globals.css`) est réutilisé — pas de second vocabulaire visuel.
- **Sélection indépendante du catalogue.** Ce panneau n'écrit **jamais** dans `lib/appFilters.ts` : cocher un Data Object dans Discover ne doit pas restreindre le catalogue ni la carte.
- **La sélection est volatile**, comme la mise en avant au clic. **Le mode de jointure l'est aussi** : ce n'est que de l'affichage. Seul l'état ouvert/fermé du panneau est persisté.
- **Aucune inférence de dépendance.** On met en avant ce qui est **lié dans le modèle** à la valeur cochée, rien de plus. Si une application A consomme une interface I porteuse du data object O sans être elle-même liée à O, A n'est pas mise en avant. Logiquement elle devrait l'être, et son absence se lit alors comme ce qu'elle est : un trou dans le modèle LeanIX, pas un défaut de l'écran. Ce choix fait de la mise en avant un **révélateur de la qualité des données**, ce qu'un calcul de proche en proche masquerait.
- **Les deux chapitres réutilisent `HierarchyTreeFilter`** et les arbres déjà chargés (`useDataObjectTree`, `useBusinessCapabilityTree`) — aucune nouvelle requête.
- **Panneau spécifique, pas générique.** Deux chapitres nommés en clair, pas une liste déclarative d'axes. Les deux axes d'aujourd'hui sont des jumeaux (même arbre `relToParent`, même composant, même règle de correspondance), mais un troisième axe ne le serait pas : portefeuille, criticité ou statut sont des énumérations plates, rendues par `Toggle` et non par `HierarchyTreeFilter`, et leur portée n'est pas la même (les interfaces ne portent que l'axe Data Object). La part générique existe déjà et est au bon endroit — `lib/hierarchyTree.ts` et `HierarchyTreeFilter`, généralisés sur un deuxième cas réel et non par anticipation. Le jour où un troisième axe **hiérarchique** sera prévu, c'est la fonction de correspondance qu'il faudra paramétrer en premier, pas le rendu.

## Requirements

### Functional Requirements

#### Le panneau

- Un panneau posé sur le bord **gauche** du canevas Discover, superposé au graphe, cadre visuellement identique à celui de la carte (`FilterPanel` : `glass-panel`, hauteur plafonnée, défilement interne).
- Un bouton chevron le replie vers la gauche et le déplie vers la droite. Replié, il ne laisse qu'une languette étroite portant le chevron inverse, et le canevas récupère toute la largeur.
- Replié alors qu'une sélection est active, la languette porte un compteur du nombre de valeurs cochées : l'atténuation du graphe ne doit jamais rester inexpliquée.
- L'état ouvert/fermé est une préférence d'affichage : persistée en `localStorage` via `lib/createPersistedStore.ts`, conformément à la règle de CLAUDE.md. Défaut : **fermé**, pour ne pas amputer le canevas à la première visite.
- Un lien « Clear » vide les deux chapitres en une action, visible seulement quand au moins une valeur est cochée.

#### Les deux chapitres

- Deux sections repliables, « Data Object » et « Business Capabilities », rendues par `HierarchyTreeFilter` — donc avec leur recherche textuelle, leurs chevrons d'arborescence et leurs cases à cocher, à l'identique du catalogue.
- Cocher un nœud parent vaut pour lui **et toute sa descendance**, selon la même règle d'expansion que le catalogue.
- Le compteur affiché sur chaque nœud compte les **applications actuellement présentes sur le diagramme** que ce nœud mettrait en avant — pas les applications du catalogue, et pas les interfaces. Un nœud à zéro reste visible (l'arborescence doit rester navigable) mais son compteur dit clairement qu'il n'éclairera aucune application.
- « Présentes sur le diagramme » veut dire **tout rectangle affiché**, y compris ceux ramenés par un dépliage de voisinage. Les puces de la barre du haut (`selected`) ne sont pas le bon ensemble : ce sont des points d'entrée pour l'exploration, pas ce que l'utilisateur a sous les yeux.
- Chaque chapitre annonce l'unité de son compteur (« applications »). Sans cela, le chiffre serait lu comme le nombre d'éléments qui vont s'allumer — or cocher un data object allume aussi des interfaces et des flux, qui ne sont pas comptés.
- L'état replié/déplié des deux sections est local au panneau ; il ne partage pas le store `filterSectionState` du catalogue, dont les clés désignent les chapitres de l'autre panneau.
- Un arbre qui ne se charge pas coûte **sa seule section**, pas le panneau ni le graphe — même contrat que le catalogue.

#### Quand les compteurs se recalculent

- **Jamais tant que le panneau est fermé.** Il l'est par défaut : une session Discover qui ne l'ouvre pas ne doit rien payer.
- Panneau ouvert, le recalcul est déclenché par l'**ajout ou la suppression d'un nœud application** sur le diagramme — sélection d'une application, dépliage d'un voisinage qui ramène des consommateurs, masquage d'un nœud et élagage qui s'ensuit.
- Il n'est **pas** déclenché par un déplacement de nœud, un zoom, un recadrage, ni par l'apparition ou la disparition d'une interface seule : rien de tout cela ne change le nombre d'applications présentes.
- Un compteur figé à l'ouverture du panneau est explicitement refusé : il deviendrait faux au premier dépliage, sans que rien à l'écran ne signale qu'il a vieilli.

#### Le mode de jointure

- Un sélecteur à deux positions, **OU** (défaut) / **ET**, en haut du panneau, au-dessus des deux chapitres. Non persisté : il revient sur **OU** à chaque visite.
- **OU** : un élément est mis en avant s'il porte **au moins une** des valeurs cochées.
- **ET** : un élément est mis en avant s'il porte **toutes** les valeurs cochées d'un chapitre donné.
- Entre les deux chapitres, la règle est toujours conjonctive, mais évaluée **seulement sur les chapitres applicables à l'élément** (voir ci-dessous) : sans cela, une interface — qui ne porte pas de business capability — ne pourrait jamais être mise en avant dès qu'une capability est cochée.
- Le sélecteur n'a d'effet visible qu'à partir de deux valeurs cochées ; il reste actif et lisible avant cela.

#### Ce qu'un élément « porte »

- **Nœud Application** : ses data objects (`Application.dataObjects`) et ses business capabilities (`Application.businessCapabilities`), résolus depuis le catalogue déjà chargé. Les deux chapitres lui sont applicables.
- **Nœud Interface** (le cercle) : les data objects qui y transitent (`DiscoverInterfaceNode.dataObjects`). Seul le chapitre Data Object lui est applicable.
- Une application absente du catalogue chargé n'a ni data object ni capability connus : elle ne peut pas être mise en avant.

#### Le rendu

- L'ensemble mis en avant est exactement : **les applications liées** à une valeur cochée, **les interfaces liées** à une valeur cochée, et **les flux qui pointent vers ces interfaces**. Rien n'est ajouté par voisinage.
- Les éléments retenus sont laissés à pleine opacité ; **tout le reste du canevas est atténué**, avec le rendu déjà en place au clic.
- Une arête est accentuée (`.rf-emph`) dès que **l'interface qu'elle vise** est retenue — c'est le flux qui transporte la donnée, et il doit se lire même si son application consommatrice n'est pas elle-même liée au data object. Toutes les autres arêtes sont atténuées.
- **En mode Simple**, les interfaces ne sont pas dessinées et les flux sont repliés en `consommateur → fournisseur`. Un flux replié est accentué si **au moins une** des interfaces qu'il replie transporte une valeur cochée — même règle, exprimée sur ce que l'écran montre réellement.
- Conséquence assumée : une interface peut rester allumée entre deux rectangles éteints. Ce n'est pas un défaut de rendu, c'est l'état du modèle — l'interface déclare transporter la donnée, les applications aux deux bouts ne déclarent pas la manipuler.
- Sélection vide dans les deux chapitres ⇒ aucune atténuation, le canevas revient à son rendu normal.
- Une sélection active qui ne retient aucun élément atténue tout le canevas ; le panneau doit dire pourquoi (« Aucun élément ne correspond »), sans quoi l'écran gris passe pour un bug.

#### Cohabitation avec la mise en avant au clic

- Les deux mécanismes écrivent les mêmes classes sur le même DOM : il leur faut **un seul propriétaire**, faute de quoi l'un effacera l'autre au prochain rendu.
- Un clic sur un nœud reste prioritaire tant qu'il est épinglé : c'est un geste explicite et transitoire. Le lever (re-clic sur le même nœud, ou clic sur le fond) **restitue** la mise en avant du panneau au lieu de tout rallumer.
- Toute évolution du canevas pendant qu'une sélection est active — ajout d'une application, dépliage d'un voisinage, masquage d'un nœud — doit voir la mise en avant appliquée aux éléments nouvellement présents.

### Non-Functional Requirements

- La mise en avant est appliquée **impérativement sur le DOM**, sans état React porté par le graphe : c'est la raison d'être de la technique actuelle, qui évite de forcer React Flow à re-mesurer les nœuds.
- Le catalogue est déjà chargé par la page, mais **pas les deux hiérarchies** : `/discover` ne les demande pas aujourd'hui. Elles sont gratuites si l'utilisateur vient du catalogue ou de la carte (cache SWR partagé, sans revalidation), et coûtent deux crawls LeanIX sur une arrivée directe — d'où l'état de chargement et d'erreur par chapitre. Rien n'est demandé tant que le panneau reste fermé.
- Classes Tailwind littérales (JIT sans safelist) ; couleurs exclusivement par tokens, pour que le panneau suive les deux axes de thème.
- Composants clients ; la page `app/discover/page.tsx` reste un composant serveur.
- Le panneau ne doit pas voler les gestes du canevas (molette, glisser) sur sa surface.
- Le contenu du diagramme circule vers le panneau dans **un seul sens**. L'abonnement du panneau ne doit jamais pouvoir provoquer un rendu du graphe : c'est la contrainte qui protège la technique ci-dessus, et le seul vrai coût de ces compteurs.

## Scope

### In Scope

- Le panneau escamotable, son chevron, sa persistance ouvert/fermé et son compteur de languette.
- Les deux chapitres hiérarchiques et le lien « Clear ».
- Le sélecteur OU / ET et sa sémantique.
- Le calcul des éléments retenus — applications, interfaces, flux visant ces interfaces — et l'application des classes.
- Les compteurs par nœud, comptant les applications du diagramme, et leur recalcul ciblé.
- L'arbitrage de priorité avec la mise en avant au clic.

### Out of Scope

- **Masquer** des nœuds selon la sélection : c'est un filtrage, pas une mise en avant, et ce n'est pas demandé.
- Persister la sélection elle-même, ou la porter dans l'URL / le lien de partage `?ids=` / `?seed=`.
- Toute écriture dans les filtres du catalogue ou de la carte.
- Un troisième axe de mise en avant (portefeuille, criticité, statut…).
- **Toute déduction de lien non présent dans le modèle** : remonter d'une interface vers ses applications, d'une application vers ses voisines, ou d'un data object vers des applications reliées de proche en proche. Ce serait afficher une information que LeanIX ne porte pas.
- Signaler à l'écran les incohérences du modèle ainsi rendues visibles (application consommant une interface porteuse d'une donnée qu'elle ne déclare pas). C'est un sujet de qualité de données, pas de rendu.
- Reporter la mise en avant dans les exports (Mermaid, PDF).
- Modifier `HierarchyTreeFilter`, les arbres ou leurs requêtes — ce sont des réemplois tels quels. Si le composant doit changer, c'est un signe que le besoin a débordé.

## Affected Areas

- `components/DiscoverClient.tsx` — accueil du panneau et point de jonction entre la sélection et le graphe.
- `components/discover/DiscoverGraph.tsx` — propriétaire des classes `.rf-dim` / `.rf-emph` ; c'est là que se joue la cohabitation avec le clic, et c'est lui qui publie la liste des applications affichées.
- `components/HierarchyTreeFilter.tsx` — réemployé sans modification.
- `lib/hierarchyTree.ts`, `lib/dataObjects.ts`, `lib/businessCapabilities.ts` — expansion des ids cochés et parcours de l'arbre, réemployés.
- `lib/useDataObjectTree.ts`, `lib/useBusinessCapabilityTree.ts` — chargement des deux hiérarchies.
- `lib/createPersistedStore.ts` — pour la seule préférence ouvert/fermé.
- `lib/types.ts` — `DiscoverInterfaceNode.dataObjects` et `Application.businessCapabilities` sont les deux sources de vérité ; aucun changement de forme attendu.
- `app/globals.css` — seulement si l'accentuation demande une nuance que `.rf-emph` ne couvre pas.

## Edge Cases

- **Canevas vide** (aucune application sélectionnée) : le panneau reste utilisable, tous les compteurs sont à zéro, rien n'est atténué.
- **Compteur à zéro sur un data object pourtant transporté par une interface visible** : normal — aucune application affichée ne déclare le manipuler. Cocher la case allumera tout de même l'interface et son flux.
- **Interface sans data object connu** : jamais retenue, et les flux qui la visent restent atténués.
- **Application hors catalogue** : ni data objects ni capabilities connus, donc jamais retenue.
- **Interface retenue entre deux applications non retenues** : cas normal, décrit plus haut — le cercle reste allumé, les rectangles restent éteints.
- **Application retenue sans aucune interface retenue autour d'elle** : cas normal aussi — elle manipule la donnée sans qu'aucun flux visible ne la transporte.
- **Nœud masqué puis le graphe élagué** pendant qu'une sélection est active : la mise en avant doit être recalculée sur ce qui reste.
- **Valeur cochée dont le nœud disparaît** d'une hiérarchie rechargée : elle cesse simplement de correspondre, sans erreur — même tolérance que le catalogue.
- **Panneau fermé, sélection active** : l'atténuation persiste ; c'est le compteur de la languette qui l'explique.
- **Mode ET avec des valeurs de deux chapitres différents** : une interface reste évaluable sur le seul chapitre Data Object.
- **Sélection active pendant un export** : l'export ignore la mise en avant (hors périmètre), ce qui ne doit surprendre personne — à vérifier au passage.

## Open Questions

Aucune — les trois questions initiales (propagation, recalcul des compteurs, généricité du panneau) ont été tranchées et remontées dans les décisions ci-dessus.

## Acceptance Criteria

1. Sur `/discover`, une languette avec un chevron apparaît sur le bord gauche du canevas ; le clic ouvre un panneau au cadre identique à celui de la carte, et le chevron s'inverse.
2. L'état ouvert/fermé survit à un rechargement de la page et à la fermeture de l'onglet.
3. Le panneau ouvert affiche exactement deux chapitres, « Data Object » et « Business Capabilities », avec la même arborescence, la même recherche et les mêmes cases que le filtre du catalogue.
4. Cocher un data object : les applications liées à ce data object, les interfaces qui le transportent et les flux visant ces interfaces restent pleinement visibles ; tout le reste du canevas est atténué.
5. Une application qui consomme une interface retenue **sans** être elle-même liée au data object coché reste atténuée — alors que le flux qui la relie à cette interface, lui, est accentué.
6. Cocher une business capability : les applications qui la couvrent restent visibles, le reste est atténué — y compris les interfaces, qui ne portent pas cet axe.
7. Cocher deux valeurs en mode **OU** met en avant l'union ; basculer en **ET** réduit à l'intersection, sans rechargement.
8. Cocher un nœud parent met en avant les mêmes éléments que cocher toute sa descendance.
9. Le nombre affiché sur un nœud de l'arbre correspond au nombre d'**applications du diagramme** que ce nœud met en avant, et chaque chapitre annonce cette unité.
10. Déplier le voisinage d'un nœud pendant que le panneau est ouvert met les compteurs à jour ; déplacer un nœud ou zoomer ne les touche pas.
11. Décocher toutes les valeurs, ou cliquer « Clear », rend au canevas son rendu normal.
12. Panneau replié avec une sélection active : la languette affiche le nombre de valeurs cochées.
13. Un clic sur un nœud du graphe prend le pas sur la mise en avant du panneau ; un clic sur le fond restitue celle du panneau, et non un canevas entièrement rallumé.
14. Ajouter une application au graphe pendant qu'une sélection est active : le nouveau nœud est immédiatement soit mis en avant, soit atténué, selon la règle.
15. Les filtres du catalogue et de la carte sont inchangés après usage du panneau — le badge de filtres actifs du catalogue ne bouge pas.
16. `npx tsc --noEmit` et `npm run build` passent ; aucune erreur ni avertissement d'hydratation en console sur `/discover`.
