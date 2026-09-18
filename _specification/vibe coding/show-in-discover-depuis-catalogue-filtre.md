# Feature Spec: Bouton "Show in Discover" depuis le Catalogue Filtré

## Summary
- Permettre à l'utilisateur de **constituer une sélection d'applications depuis la page Catalogue** (en utilisant le panneau de filtres de gauche déjà existant) puis de **l'ouvrir d'un clic dans la page Discover**, où les applications sélectionnées sont affichées avec **toutes les relations (interfaces) qui les relient entre elles**.
- Concrètement : un nouveau bouton **"Show in Discover"** est ajouté dans le panneau latéral gauche du Catalogue, sous le bouton `Export PDF (N)` existant, et porte le même compteur que le résultat courant du filtrage (ex. `Show in Discover (12)`).
- Un clic ouvre **dans un nouvel onglet** la page Discover, pré-alimentée avec la liste des applications filtrées : chaque application apparaît comme **chip dans la barre de sélection** (à droite du champ de recherche), exactement comme si l'utilisateur les avait ajoutées une à une via le champ de recherche.
- En plus de l'ajout des nœuds racines, Discover **résout et affiche automatiquement les relations internes à la sélection** : les interfaces dont le provider **et** au moins un consommateur appartiennent tous deux à la sélection, avec les flèches correspondantes. Les interfaces menant vers des applications hors sélection ne sont **pas** affichées à l'ouverture (elles restent accessibles à la demande via les menus contextuels déjà en place).
- Le transport de la sélection se fait par un **paramètre d'URL** sur la route Discover, ce qui rend le lien **partageable et rejouable** (copier/coller de l'URL, favori).

## Motivation
- Aujourd'hui les deux pages sont étanches : le Catalogue sait **filtrer finement** (recherche texte, catégories, statuts, portfolios, criticité métier, opérateur, présence de photo) mais n'affiche que des cartes ; Discover sait **explorer les dépendances** mais n'offre qu'un ajout **unitaire** via le champ de recherche. Construire un graphe sur 15 applications d'un même portfolio demande 15 recherches manuelles successives — coût prohibitif et source d'oublis.
- Le cas d'usage réel est exactement la jonction des deux : « je veux voir comment les applications de tel portfolio / telle criticité / tel domaine s'interconnectent entre elles ». La sélection est déjà exprimable par les filtres du Catalogue ; il ne manque qu'un pont.
- L'ouverture **dans un nouvel onglet** préserve le contexte de filtrage du Catalogue (les filtres vivent en mémoire uniquement, cf. `lib/catalogueFilters.ts`) et permet de garder les deux vues côte à côte pour itérer : ajuster le filtre, relancer un graphe.
- L'affichage automatique des seules relations **internes à la sélection** répond au besoin exprimé (« avec toutes les relations les reliant ») tout en évitant l'explosion visuelle qu'entraînerait un dépliage complet des interfaces vers l'extérieur.

## Décisions (arbitrées)
- **Emplacement et libellé du bouton** : dans le panneau latéral gauche de `CatalogueClient`, **immédiatement sous** le bouton `Export PDF (N)`, même gabarit visuel (bouton pleine largeur, `text-xs font-mono`, bordure + surface, hover accent). Libellé : `Show in Discover (N)` où `N` est le nombre d'applications visibles après filtrage.
- **Desktop uniquement dans cette itération** : le bouton n'est **pas** repris dans `FilterSheet` (panneau de filtres mobile). Vérifié : `FilterSheet` est aujourd'hui un pur éditeur de filtres — il ne rend que le `FilterBar`, un en-tête et un bouton de validation `Show N results` qui referme la sheet ; il ne porte **ni** le bouton `Export PDF`, **ni** le compteur `N / M applications`, et ne reçoit ni la liste d'applications ni de callback d'action. Ajouter `Show in Discover` là serait donc une asymétrie (une action présente, l'autre pas) et imposerait de faire descendre la liste filtrée jusqu'au composant. Si les actions doivent un jour exister en mobile, c'est un chantier distinct qui descend **les deux** boutons ensemble. À noter que l'URL `/discover?ids=…` reste ouvrable depuis un mobile : seul le point d'entrée depuis le catalogue est absent.
- **État désactivé** : bouton désactivé (même style `disabled:opacity-50`) lorsque la liste filtrée est vide.
- **Ouverture** : nouvel onglet. Le bouton est rendu comme un lien (`target="_blank"`, `rel="noopener noreferrer"`) plutôt que via `window.open`, pour rester compatible avec le clic-milieu / Ctrl+clic et ne pas être bloqué par les popup blockers.
- **Transport de la sélection** : paramètre de requête `?ids=<id1>,<id2>,…` sur la route `/discover`, portant les **`id` techniques** des applications — jamais les `externalId`, conformément à la décision déjà actée pour Discover (une application peut ne pas avoir d'`externalId`, et les requêtes GraphQL filtrent par `ids`). L'ordre des ids reproduit l'ordre d'affichage courant du catalogue filtré.
- **Portée de la sélection transmise** : **toutes** les applications correspondant aux filtres courants, pas seulement la page affichée (le Catalogue est paginé 6 par page ; la pagination est une commodité d'affichage, pas un critère de sélection). Cohérent avec le comportement déjà retenu pour `Export PDF`.
- **Garde-fous de volume** : deux seuils, alignés sur le pattern de confirmation déjà utilisé par l'export PDF.
  - Au-delà de **25** applications, une confirmation explicite est demandée avant l'ouverture (le graphe devient dense et le chargement des relations plus long).
  - Au-delà de **100** applications, l'action est refusée avec un message invitant à affiner les filtres (protection contre une URL démesurée et un fan-out de requêtes ingérable). Ces deux seuils sont des constantes nommées, ajustables sans refonte.
- **Lecture du paramètre côté Discover** : `DiscoverClient` lit `?ids=` **une seule fois**, au premier rendu où le catalogue d'applications est chargé, puis résout chaque id contre la liste d'applications déjà disponible (`useApplications`). Les applications résolues sont ajoutées à la sélection (chips) et au graphe en un seul lot.
- **Ajout en lot, pas en boucle d'ajouts unitaires** : l'API impérative du graphe reçoit une nouvelle opération de **seed** prenant la liste complète, de façon à pouvoir calculer **un unique layout ELK** sur l'ensemble obtenu (applications + interfaces internes). Enchaîner les `addApplication` existants produirait un alignement horizontal dégradé (chaque nœud placé « à droite » du précédent) et non un graphe lisible.
- **Résolution automatique des relations internes** : après le seed, les interfaces de chaque application de la sélection sont chargées (requêtes existantes de `lib/leanix-application-query.ts` / `lib/leanix-interface-query.ts` déjà utilisées par Discover), puis **filtrées** : seules sont matérialisées les interfaces dont le **provider appartient à la sélection** *et* qui ont **au moins un consommateur appartenant à la sélection**. Les autres interfaces sont ignorées à l'ouverture.
- **Une interface partagée reste unique** : une interface reliant trois applications de la sélection produit un seul cercle et plusieurs flèches entrantes, conformément au modèle déjà en place.
- **Layout initial** : un **unique** calcul ELK (même algorithme que le layout initial actuel de Discover) sur le graphe complet obtenu après résolution des relations, puis plus aucun recalcul global — les actions ultérieures (menus contextuels, ajout via recherche, retrait de chip) conservent le comportement actuel.
- **Le paramètre d'URL est une graine, pas un état synchronisé** : il est lu une fois à l'ouverture ; les ajouts/retraits ultérieurs faits par l'utilisateur dans Discover **ne réécrivent pas** l'URL. Recharger la page reproduit donc la sélection d'origine, pas l'état exploré. C'est assumé : le lien reste un point d'entrée stable et partageable.
- **Discover sans paramètre** : comportement strictement inchangé (canevas vide, message d'invitation, ajout unitaire via la recherche).
- **Aucun changement du modèle de filtrage** : le Catalogue conserve ses filtres, sa pagination, son export PDF et son store mémoire à l'identique ; la fonctionnalité ne fait que consommer la liste filtrée déjà calculée.

## Requirements

### Functional Requirements
- Un bouton `Show in Discover (N)` est présent dans le panneau de filtres du Catalogue, sous le bouton d'export PDF, et affiche le nombre d'applications actuellement filtrées.
- Le bouton est désactivé lorsque le filtrage ne retourne aucune application.
- Un clic ouvre la page Discover **dans un nouvel onglet**, l'onglet Catalogue restant intact (filtres et page courante préservés).
- La sélection transmise correspond à **l'intégralité** des applications filtrées, indépendamment de la pagination.
- Au-delà du seuil de confirmation, une confirmation est demandée avant ouverture ; au-delà du seuil maximal, l'ouverture est refusée avec un message explicite.
- À l'ouverture, Discover affiche chaque application transmise comme **chip** dans la barre de sélection et comme **rectangle racine** dans le graphe.
- Discover affiche automatiquement les **interfaces reliant deux applications de la sélection**, avec les flèches consommateur → interface, sans action supplémentaire de l'utilisateur.
- Les interfaces reliant une application de la sélection à une application **hors sélection** ne sont pas affichées à l'ouverture ; elles restent atteignables via les menus contextuels existants.
- Le layout du graphe initial est calculé une seule fois, sur l'ensemble applications + interfaces internes.
- Un état de chargement explicite est visible pendant la résolution des relations de la sélection.
- Après l'ouverture, l'utilisateur peut continuer à ajouter/retirer des applications via le champ de recherche et les chips, exactement comme aujourd'hui.
- Ouvrir `/discover` sans paramètre conserve le comportement actuel.

### Non-Functional Requirements
- **Aucune dépendance npm nouvelle.**
- **Aucune nouvelle route** : la fonctionnalité réutilise `/discover` avec un paramètre de requête (cohérent avec la convention du repo : `?id=` sur la fiche détail est un paramètre assumé, pas une généralisation d'axe de navigation).
- **Thème** : bouton et éventuels messages utilisent exclusivement les tokens `--color-*` / classes utilitaires existantes ; lisible en clair comme en sombre.
- **Isolation des pannes** : l'échec du chargement des relations d'une application ne doit casser ni le graphe ni les autres applications de la sélection — les nœuds restent affichés, l'erreur est signalée localement.
- **Coût réseau maîtrisé** : la résolution des relations doit éviter les appels redondants (une application déjà chargée n'est pas rechargée) ; le fan-out est borné par le seuil maximal d'applications.
- **Pas de régression de performance sur le Catalogue** : la construction de la liste d'ids est dérivée de la liste filtrée déjà mémoïsée, sans recalcul supplémentaire à chaque rendu.

### Accessibility Requirements
- Le bouton est un contrôle focusable au clavier, avec un libellé explicite et une indication que le lien s'ouvre dans un nouvel onglet.
- L'état désactivé est exposé sémantiquement (pas seulement visuellement).

## Scope

### In Scope
- Ajout du bouton `Show in Discover (N)` dans le panneau de filtres **desktop** du Catalogue.
- Construction du lien vers Discover portant la liste des `id` techniques filtrés.
- Garde-fous de volume (confirmation et refus au-delà des seuils).
- Lecture et résolution du paramètre à l'ouverture de Discover ; alimentation de la barre de chips et du graphe en un seul lot.
- Nouvelle opération de seed sur l'API impérative du graphe Discover, avec un unique calcul de layout sur l'ensemble obtenu.
- Résolution automatique et filtrage des interfaces internes à la sélection, réutilisant les requêtes GraphQL déjà en place.
- États de chargement et d'erreur associés à cette ouverture en lot.

### Out of Scope
- **Point d'entrée mobile** : reprise du bouton dans `FilterSheet` (et, plus largement, descente des actions du panneau desktop vers le panneau mobile).
- **Sélection manuelle case-à-cocher** d'applications individuelles dans le catalogue (la sélection est exclusivement le résultat du filtrage courant).
- **Synchronisation bidirectionnelle** de l'URL Discover avec l'état du graphe exploré (ajouts/retraits ultérieurs, positions, nœuds dépliés).
- **Sauvegarde/export** du graphe Discover (toujours reporté, cf. spec Discover initiale).
- Affichage à l'ouverture des interfaces vers des applications hors sélection, ou dépliage automatique de proche en proche.
- Affichage des Data Objects portés par les interfaces.
- Modification des filtres, de la pagination ou de l'export PDF du Catalogue.
- Transport des filtres eux-mêmes (plutôt que de la liste d'ids résolue) vers Discover.
- Toute écriture vers le backend.

## Affected Areas
- **Modifier** : `components/CatalogueClient.tsx` — ajout du bouton sous l'export PDF, construction du lien et garde-fous de volume.
- **Non touché** : `components/FilterSheet.tsx` — le panneau de filtres mobile reste un pur éditeur de filtres (il ne porte pas non plus l'export PDF).
- **Modifier** : `components/DiscoverClient.tsx` — lecture du paramètre d'URL, résolution des ids contre `useApplications`, seed en lot de la sélection et des chips, état de chargement dédié.
- **Modifier** : `app/discover/page.tsx` — encapsulation dans une frontière `Suspense` si la lecture du paramètre l'impose (même contrainte que la page de détail qui lit `?id=`).
- **Modifier** : `components/discover/DiscoverGraph.tsx` — nouvelle opération de seed sur `DiscoverGraphHandle` (ajout d'un lot d'applications + interfaces internes), déclenchement d'un unique layout sur l'ensemble.
- **Modifier / étendre** : `lib/discover-graph-layout.ts` — application du layout initial à un graphe multi-nœuds issu du seed (aujourd'hui le premier nœud est placé à l'origine et les suivants « à droite »).
- **Réutiliser sans modifier** : `lib/leanix-application-query.ts`, `lib/leanix-interface-query.ts`, `lib/discover-graph-adapter.ts`, `components/discover/ApplicationSearch.tsx`, `components/discover/SelectedApplicationsBar.tsx`, `lib/applications.ts` (`filterApplications`).
- **Non touché** : `lib/catalogueFilters.ts` (store de filtres inchangé), export PDF, `/map`, fiche détail Application, `/health`.

## Edge Cases
- **Aucune application filtrée** → bouton désactivé, aucune ouverture possible.
- **Une seule application filtrée** → graphe à un seul rectangle, sans interface interne (aucune relation « entre » applications) ; comportement valide, pas d'erreur.
- **Sélection dépassant le seuil de confirmation** → confirmation demandée ; un refus laisse le Catalogue inchangé.
- **Sélection dépassant le seuil maximal** → ouverture refusée avec message invitant à affiner les filtres.
- **Id inconnu ou obsolète dans le paramètre** (application supprimée côté source, lien ancien) → ignoré silencieusement ; les applications résolues sont affichées et le nombre d'ids ignorés est signalé de façon discrète.
- **Paramètre `ids` vide, malformé, ou dupliqué** (`?ids=`, séparateurs en trop, même id deux fois) → dédoublonnage et filtrage des entrées vides ; si rien ne subsiste, Discover se comporte comme une ouverture sans paramètre.
- **Application sans `externalId`** → elle doit être transmise et affichée normalement (l'identification passe par l'`id` technique) ; à noter que le champ de recherche de Discover exclut aujourd'hui ces applications — le seed ne doit pas hériter de cette exclusion.
- **Applications filtrées sans aucune interface entre elles** → tous les rectangles sont affichés, sans aucun cercle ni flèche ; état valide, éventuellement accompagné d'une indication qu'aucune relation interne n'a été trouvée.
- **Interface reliant deux applications de la sélection via un provider hors sélection** → non affichée à l'ouverture selon la règle retenue ; cf. Open Questions.
- **Échec réseau sur la résolution des relations d'une ou plusieurs applications** → les rectangles restent affichés, l'erreur est signalée sans vider le graphe.
- **Ouverture d'un second lien Discover depuis le Catalogue** → chaque clic ouvre un onglet indépendant, sans interférence entre les deux graphes (état purement client, non partagé).
- **Rechargement de l'onglet Discover** (F5) → la sélection d'origine est reconstruite depuis l'URL ; l'exploration manuelle effectuée depuis l'ouverture est perdue (conséquence assumée de la décision « graine, pas état »).

## Open Questions
- **Interfaces dont le provider est hors sélection** : la règle retenue (provider ET au moins un consommateur dans la sélection) exclut le cas où deux applications sélectionnées sont toutes deux **consommatrices** d'une même interface fournie par une application non sélectionnée. Ce cas représente pourtant une forme de « relation » entre elles. Faut-il l'afficher (ce qui impose d'ajouter au graphe le cercle d'interface, voire son provider hors sélection), ou le laisser hors périmètre comme actuellement décidé ? => non ne pas l'afficher

- **Seuils de volume** : les valeurs 25 (confirmation) et 100 (refus) sont posées par défaut et à confirmer à l'usage sur des sélections réelles.=> oui à confirmer à l'usage


- **Signalement des ids non résolus** : forme exacte du message (bandeau discret, compteur dans la barre de sélection, ou rien) à préciser au design.

## Acceptance Criteria
- [ ] Un bouton `Show in Discover (N)` est visible dans le panneau de filtres desktop du Catalogue, sous le bouton d'export PDF, avec le compteur des applications filtrées.
- [ ] `FilterSheet` (panneau de filtres mobile) est inchangé — il ne porte pas le bouton.
- [ ] Le bouton est désactivé quand aucune application ne correspond aux filtres.
- [ ] Un clic ouvre Discover dans un **nouvel onglet** ; l'onglet Catalogue conserve ses filtres et sa page courante.
- [ ] La sélection transmise contient toutes les applications filtrées, y compris celles des pages non affichées.
- [ ] Une confirmation est demandée au-delà du seuil de confirmation ; l'ouverture est refusée avec message au-delà du seuil maximal.
- [ ] Dans Discover, chaque application transmise apparaît comme chip dans la barre de sélection et comme rectangle dans le graphe.
- [ ] Les interfaces reliant deux applications de la sélection sont affichées automatiquement, avec les flèches consommateur → interface, sans action utilisateur.
- [ ] Une interface partagée par plusieurs applications de la sélection n'apparaît qu'une seule fois.
- [ ] Aucune interface vers une application hors sélection n'est affichée à l'ouverture.
- [ ] Le layout du graphe est calculé une seule fois sur l'ensemble seedé, et les nœuds ne sont pas simplement alignés horizontalement.
- [ ] Un état de chargement est visible pendant la résolution des relations, puis disparaît.
- [ ] Une application sans `externalId` présente dans la sélection est bien affichée dans le graphe.
- [ ] Des ids inconnus, vides ou dupliqués dans l'URL n'empêchent pas l'affichage des applications valides.
- [ ] L'échec de chargement des relations d'une application ne vide pas le graphe.
- [ ] Ouvrir `/discover` sans paramètre reproduit exactement le comportement actuel.
- [ ] Après ouverture, l'ajout via la recherche et le retrait de chips fonctionnent comme avant.
- [ ] Le bouton et les messages sont lisibles en thème clair et en thème sombre, sans couleur codée en dur.
- [ ] Aucune dépendance npm ajoutée ; build Next OK (`npm run build`).
