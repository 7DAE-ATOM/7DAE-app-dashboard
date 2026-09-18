# Feature Spec: Filtre Business Capabilities Hiérarchique

## Summary
- Ajouter un **nouvel axe de filtrage « Business Capabilities »** au panneau de filtres du Catalogue, à côté des axes existants (Category, Status, Portfolio, Operator, Business Criticality).
- Contrairement à ces axes — tous **plats**, rendus par le composant `Toggle` en pills —, celui-ci est **hiérarchique** : les Business Capabilities LeanIX forment un arbre (chaque capability a un parent et des enfants).
- Rendu retenu : **arbre replié en place** dans le panneau, un chevron par nœud pour déplier/replier, une case à cocher par nœud, un **compteur** à droite de chaque libellé, et un **champ de recherche** en tête de section qui ne laisse que les nœuds correspondants et leur chemin d'ancêtres.
- **Cocher un parent ramène toutes les applications accrochées à ses descendants** (expansion implicite au sous-arbre) — sans quoi, les applications étant accrochées aux feuilles, cocher un nœud intermédiaire ne ramènerait rien et le filtre paraîtrait cassé.
- Plusieurs capabilities cochées se combinent en **OU**, comme tous les autres axes du filtre.
- L'arbre est **chargé en entier** (aucun élagage des branches sans application), par une **requête GraphQL dédiée** lancée **en parallèle** du chargement du catalogue.

## Motivation
- La fiche détail d'une application expose déjà ses Business Capabilities dans l'onglet **DATA** (`components/detail/DataTab.tsx`), alimenté par `relApplicationToBusinessCapability` déjà présent dans la requête du catalogue (`lib/leanix-application-query.ts`) et mappé en `Application.businessCapabilities` (`lib/application-adapter.ts`). L'information est donc **déjà chargée pour chaque application** — mais elle n'est aujourd'hui **consultable qu'application par application**, jamais utilisable comme critère de recherche.
- Le besoin métier est l'inverse : partir d'une capability (« quelles applications supportent l'assemblage final ? ») et obtenir la liste. Aujourd'hui, cela impose d'ouvrir les fiches une à une.
- La dimension hiérarchique est indissociable du besoin : une capability parent regroupe un domaine entier, et l'utilisateur raisonne à ce niveau (« tout l'Engineering ») autant qu'au niveau feuille. Un filtre plat listant 60 capabilities sans structure obligerait à connaître par cœur quelle feuille appartient à quel domaine.
- Les liaisons `Application → BusinessCapability` ne portent **pas** les parents : l'application ne connaît que les capabilities auxquelles elle est directement rattachée. La hiérarchie doit donc venir d'une **source séparée**, et être tenue en mémoire côté client pour résoudre l'expansion parent → descendants.

## Volumétrie constatée
Chiffres fournis, qui conditionnent le choix de rendu :
- **~60 Business Capabilities** au total.
- **8 racines** (capabilities sans parent) — c'est ce que voit l'utilisateur à l'ouverture, arbre replié.
- **5 niveaux maximum** de profondeur, dont **4 réellement utilisés** aujourd'hui.
- Chaque application est liée à **1 à 8 capabilities** (moyenne).
- Les applications **devraient idéalement** ne pointer que vers des **feuilles** — « idéalement » : la donnée réelle contiendra des exceptions (cf. Décisions).

À cette échelle, un arbre affiché en place tient largement : 8 lignes replié, 60 lignes entièrement déplié. C'est ce qui a fait écarter les alternatives envisagées (picker en modale plein écran, navigation par niveau avec fil d'Ariane, combobox sans arbre visible), qui n'auraient de sens que sur une taxonomie d'un ordre de grandeur supérieur.

## Décisions (arbitrées)
- **Emplacement** : nouvelle section « Business Capabilities » dans `FilterBar`, au même niveau que les autres axes. `FilterSheet` (panneau de filtres mobile) rend déjà `FilterBar` : le nouvel axe y apparaît donc **automatiquement**, sans travail dédié — la sheet est déjà scrollable verticalement.
- **Rendu** : nouveau composant d'arbre, **sans réutiliser le `Toggle` plat** existant (inadapté : ni indentation, ni chevron, ni compteur). Case à cocher + chevron + libellé + compteur par ligne, indentation par profondeur.
- **État replié par défaut** : les 8 racines sont visibles, tout le reste est replié. L'état d'ouverture est **local au composant**, non persisté, et **non** stocké dans `FilterValue`.
- **Hauteur bornée** : la section a une hauteur maximale (~320 px) avec scroll interne, pour qu'un arbre largement déplié ne repousse pas les autres axes hors de l'écran.
- **Recherche** : champ de recherche en tête de section, filtrant l'arbre sur le nom. Seuls les nœuds correspondants **et leur chemin d'ancêtres** restent affichés, et les chemins concernés sont **dépliés automatiquement**. Vider le champ restaure l'état replié précédent. La recherche porte sur cet arbre uniquement — elle est indépendante du champ de recherche global du filtre (qui, lui, cherche dans nom/référence/manager/opérateur des applications).
- **Sélection** : multi-sélection, **à n'importe quel niveau** de l'arbre. La valeur stockée est un ensemble d'**`id` techniques** de capabilities.
- **Cocher un parent n'auto-coche pas visuellement ses enfants** : l'expansion au sous-arbre se fait **au moment du filtrage**, pas dans l'état de l'UI. Décocher le parent libère donc la sélection d'un seul coup, et un enfant coché explicitement reste distinct de son parent coché.
- **Sémantique de filtrage** : une application est retenue si **au moins une** de ses capabilities appartient au sous-arbre (nœud inclus) d'**au moins un** nœud coché. Soit : **OU** entre les nœuds cochés, expansion aux descendants pour chacun.
- **Applications accrochées à un nœud intermédiaire** : le code de filtrage ne doit **pas** supposer un accrochage aux feuilles. Le comportement qui découle de la règle ci-dessus est bien défini et voulu : une application accrochée à un nœud intermédiaire est ramenée quand on coche **ce nœud ou l'un de ses ancêtres**, mais **pas** quand on coche l'une de ses feuilles.
- **Aucun élagage** : l'arbre complet est affiché, y compris les branches ne portant aucune application. Ces branches ne sont **pas grisées** ni désactivées — leur compteur à `0` suffit à les signaler.
- **Compteurs** : le nombre affiché à droite d'un nœud est le nombre d'applications que ce nœud ramènerait **compte tenu des autres filtres actifs** (statut, portfolio, recherche…), et non un total absolu sur tout le catalogue. Il dit donc la vérité de ce qui va s'afficher. Il se recalcule à chaque changement de filtre : à 60 nœuds sur le volume du catalogue, le coût est négligeable et ne justifie aucune optimisation particulière.
- **Un seul parent par capability** : bien que `relToParent` renvoie des `edges` au pluriel, la donnée garantit un parent unique. On lit la première arête sans arbitrage multi-parents, et l'arbre est un vrai arbre (aucun nœud affiché deux fois).
- **Identification par `id` technique**, jamais par `externalId` — ce dernier est nullable sur une Business Capability (`lib/types.ts`) et sert uniquement à l'affichage éventuel. Même règle que partout ailleurs dans l'application.
- **Profondeur non codée en dur** : l'arbre est reconstruit par les liens parent ; le 5ᵉ niveau aujourd'hui inutilisé ne demande aucun traitement spécifique, et un 6ᵉ niveau futur non plus.
- **Chargement** : requête GraphQL dédiée (modèle fourni dans `temp/getbusinessCapability.txt`), **paginée** comme l'est déjà la requête des applications (`allFactSheets` expose `pageInfo.hasNextPage` / `endCursor`), lancée **en parallèle** du chargement du catalogue et partagée entre les pages par le même mécanisme de cache que les applications. Le filtre est ainsi prêt dès l'arrivée sur la page.
- **Échec du chargement de l'arbre** : la section « Business Capabilities » est **omise** du panneau plutôt que de faire échouer la page. Les autres axes et le catalogue restent pleinement fonctionnels.
- **Description des filtres** : le nouvel axe doit apparaître dans la sérialisation des filtres utilisée par l'en-tête de l'export PDF, sinon l'export mentirait sur les filtres appliqués. Les capabilities cochées y sont listées **par leur nom**.

## Requirements

### Functional Requirements
- Une section « Business Capabilities » apparaît dans le panneau de filtres du Catalogue, en desktop comme en mobile.
- À l'ouverture, seules les capabilities racines sont affichées, repliées.
- Chaque nœud ayant des enfants expose un chevron qui déplie/replie son sous-arbre.
- Chaque nœud expose une case à cocher, à n'importe quel niveau.
- Chaque nœud affiche à droite le nombre d'applications qu'il ramènerait compte tenu des autres filtres actifs.
- Un champ de recherche en tête de section filtre l'arbre par nom, en conservant le chemin d'ancêtres des nœuds correspondants et en dépliant automatiquement ces chemins.
- Vider le champ de recherche restaure l'état déplié/replié antérieur.
- Cocher un nœud retient les applications liées à ce nœud **ou à n'importe lequel de ses descendants**.
- Plusieurs nœuds cochés se combinent en OU.
- L'axe Business Capabilities se combine en ET avec les autres axes du filtre, comme ceux-ci entre eux.
- Le compteur global (`N / M applications`) et la pagination du catalogue reflètent le filtre comme pour tout autre axe.
- Les capabilities cochées apparaissent dans la description des filtres de l'export PDF.
- Si le chargement de l'arbre échoue, la section est absente et le reste du filtre fonctionne normalement.

### Non-Functional Requirements
- **Aucune dépendance npm nouvelle** — pas de bibliothèque d'arbre tierce.
- **Thème** : couleurs exclusivement issues des tokens `--color-*` existants ; lisible en clair comme en sombre.
- **Cohérence visuelle** : mêmes libellés de section (majuscules, `text-muted`), mêmes rayons et bordures que les autres axes du panneau.
- **Pas de régression de performance** : le recalcul des compteurs à chaque changement de filtre reste imperceptible (~60 nœuds).
- **Pas de blocage au premier rendu** : le catalogue s'affiche sans attendre l'arbre ; la section apparaît quand l'arbre est disponible.

### Accessibility Requirements
- Les cases à cocher et les chevrons sont atteignables et actionnables au clavier.
- L'état déplié/replié d'un nœud est exposé sémantiquement, pas seulement visuellement.
- Le compteur est lisible par un lecteur d'écran en association avec le libellé du nœud.

## Scope

### In Scope
- Récupération paginée de l'ensemble des Business Capabilities (id, nom, externalId, parent) et reconstruction de l'arbre côté client.
- Nouveau composant d'arbre à cocher (chevron, indentation, compteur, hauteur bornée avec scroll).
- Champ de recherche interne à la section, avec dépliage automatique des chemins correspondants.
- Nouvel axe dans la valeur de filtre et dans la fonction de filtrage des applications, avec expansion aux descendants.
- Compteurs par nœud tenant compte des autres filtres actifs.
- Prise en compte du nouvel axe dans la description des filtres de l'export PDF.
- Comportement dégradé si l'arbre ne charge pas.

### Out of Scope
- **Signalement de qualité de donnée** : aucun badge ni avertissement lorsqu'une application est accrochée à un nœud intermédiaire plutôt qu'à une feuille.
- **Affichage de la hiérarchie dans l'onglet DATA** de la fiche détail — il continue d'afficher la liste plate des capabilities directement liées.
- **Navigation** depuis une capability (aucun lien cliquable vers une fiche capability, qui n'existe pas).
- Filtrage par Business Capability sur la page `/map` ou dans la page Discover.
- Persistance de l'état déplié/replié entre deux visites.
- Élagage ou grisage des branches sans application.
- Combinaison ET entre capabilities cochées.
- Gestion d'une capability à plusieurs parents.
- Toute écriture vers le backend.

## Affected Areas
- **Créer** : module de requête GraphQL des Business Capabilities (à côté des modules de requête LeanIX existants), calqué sur `temp/getbusinessCapability.txt`, avec pagination.
- **Modifier** : `lib/atom-api.ts` — fonction de récupération paginée de toutes les Business Capabilities, sur le modèle de la boucle déjà utilisée pour les applications.
- **Créer** : module de domaine pour l'arbre (construction depuis la liste plate, ensemble des descendants d'un nœud, expansion d'une sélection en ensemble d'ids, comptage par nœud).
- **Créer** : hook de chargement de l'arbre, partagé entre les pages par le même mécanisme de cache que `lib/useApplications.ts`.
- **Créer** : composant d'arbre à cocher utilisé par la section du filtre.
- **Modifier** : `components/FilterBar.tsx` — nouvelle section, nouveau champ dans `FilterValue`.
- **Modifier** : `lib/catalogueFilters.ts` — valeur par défaut du nouveau champ.
- **Modifier** : `lib/applications.ts` — prise en compte du nouvel axe dans `filterApplications`.
- **Modifier** : `lib/filterDescription.ts` — sérialisation du nouvel axe pour l'export PDF.
- **Non touché** : `components/FilterSheet.tsx` (il rend déjà `FilterBar`, le nouvel axe y arrive sans modification), `components/detail/DataTab.tsx`, `lib/application-adapter.ts` (les capabilities par application sont déjà mappées), pages `/map` et Discover.

## Edge Cases
- **Application sans aucune capability** → exclue dès qu'au moins un nœud est coché ; visible tant qu'aucun ne l'est.
- **Capability sans application** → affichée avec un compteur à `0`, cochable ; la cocher seule ne ramène rien.
- **Nœud parent dont seuls les descendants portent des applications** → son compteur agrège le sous-arbre et est donc non nul, alors qu'aucune application ne lui est directement liée.
- **Parent et enfant cochés simultanément** → aucun doublon : le résultat est l'union des deux sous-arbres, l'enfant étant déjà inclus dans celui du parent.
- **Application accrochée à un nœud intermédiaire** → ramenée en cochant ce nœud ou l'un de ses ancêtres, pas en cochant l'une de ses feuilles (comportement voulu, cf. Décisions).
- **Capability dont le parent est absent de la réponse** (donnée incohérente, page manquante) → traitée comme une racine plutôt que silencieusement perdue.
- **Cycle dans les liens parent** (donnée corrompue) → la construction de l'arbre doit s'en prémunir sans boucle infinie.
- **Capability sans nom** → repli d'affichage cohérent avec le mapping existant (qui substitue déjà un tiret cadratin à un nom vide).
- **Recherche sans résultat** → message neutre dans la section, aucun nœud affiché ; les cases déjà cochées restent actives (la recherche n'est qu'un filtre d'affichage).
- **Nœud coché puis masqué par la recherche** → il reste sélectionné et continue de filtrer le catalogue.
- **Arbre chargé après le catalogue** → la section apparaît sans réinitialiser les filtres déjà posés par l'utilisateur.
- **Échec réseau de l'arbre seul** → section omise, aucun impact sur le catalogue ni sur les autres axes.

## Open Questions
- **Affichage de l'`externalId`** d'une capability à côté de son nom dans l'arbre (utile pour lever une homonymie entre deux branches, mais alourdit la ligne) — non tranché, `externalId` étant par ailleurs nullable.
=> Non les noms des capabailités sont déjà trés longues 

- **Comportement du bouton « Catalogue » du menu** (qui réinitialise déjà les filtres) sur l'état déplié/replié de l'arbre : réinitialisation complète ou conservation de l'ouverture — à préciser au design, sans impact fonctionnel sur le filtrage. => réinitialisation complére dans cette version

## Acceptance Criteria
- [ ] Une section « Business Capabilities » est présente dans le panneau de filtres du Catalogue, en desktop comme en mobile.
- [ ] À l'ouverture, les 8 racines sont visibles et repliées.
- [ ] Un chevron déplie/replie le sous-arbre d'un nœud ; l'indentation traduit la profondeur.
- [ ] Une case à cocher est disponible sur les nœuds de tous les niveaux, racines et feuilles comprises.
- [ ] Cocher un parent ramène les applications accrochées à ses descendants.
- [ ] Cocher plusieurs nœuds combine leurs résultats en OU.
- [ ] L'axe se combine en ET avec les autres axes du filtre.
- [ ] Chaque nœud affiche un compteur qui tient compte des autres filtres actifs et se met à jour quand ceux-ci changent.
- [ ] Les branches sans application sont affichées, avec un compteur à `0`, et restent cochables.
- [ ] La recherche interne ne laisse que les nœuds correspondants et leur chemin d'ancêtres, en dépliant ces chemins.
- [ ] Vider la recherche restaure l'état déplié/replié antérieur, et les cases cochées n'ont pas bougé.
- [ ] Une capability cochée puis masquée par la recherche continue de filtrer le catalogue.
- [ ] Le compteur global `N / M applications` et la pagination reflètent le nouvel axe.
- [ ] Les capabilities cochées apparaissent, par leur nom, dans la description des filtres de l'export PDF.
- [ ] Si le chargement de l'arbre échoue, la section est absente et le reste de la page fonctionne.
- [ ] Le catalogue s'affiche sans attendre le chargement de l'arbre.
- [ ] La section reste lisible en thème clair et en thème sombre, sans couleur codée en dur.
- [ ] Aucune dépendance npm ajoutée ; build Next OK (`npm run build`).
