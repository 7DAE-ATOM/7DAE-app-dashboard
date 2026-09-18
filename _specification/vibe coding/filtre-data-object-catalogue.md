# Feature Spec: Filtre par Data Object dans le Catalogue

## Summary
- Ajouter au panneau de filtres du catalogue un **axe « Data Objects »**, affiché **juste après « Business Capabilities »**.
- Même présentation que l'axe Business Capabilities, parce que la donnée a la même forme : un **champ de recherche** au-dessus d'un **arbre de cases à cocher repliable**, les Data Objects étant hiérarchisés par la relation `relToParent`.
- La hiérarchie est rapatriée par une requête dédiée sur `allFactSheets(factSheetType: DataObject)`, qui ramène pour chaque Data Object son `id`, son `externalId`, son `name`, sa `description`, son parent (`relToParent`) et les applications liées (`relDataObjectToApplication`).
- **L'identité est portée par l'`id` technique.** L'`externalId` est systématiquement nul aujourd'hui ; il est tout de même conservé dans le modèle, puisqu'il a vocation à devenir la référence inter-systèmes.
- Cocher un nœud parent sélectionne implicitement toute sa descendance, comme pour les Business Capabilities : l'expansion se fait au moment du filtrage, jamais en cochant les enfants dans l'interface.
- L'axe est partagé par le catalogue, la carte et le panneau mobile, qui rendent tous le même composant de filtres.

## Motivation
- Le parc se lit aujourd'hui par capacité métier, catégorie, portefeuille, statut et criticité — mais **pas par la donnée manipulée**. Or « quelles applications touchent aux données de vol ? » est une question d'architecture aussi courante que « quelles applications servent cette capacité ? ».
- Les Data Objects sont déjà présents dans l'application, mais seulement en **lecture** : listés sur la carte d'identité d'une application dans Discover, et depuis peu détaillés sur la carte d'une interface. Ils ne sont encore un critère de sélection nulle part.
- La donnée est **hiérarchique** dans LeanIX, exactement comme les capacités métier. Sans arbre, cocher un domaine de données parent ne voudrait rien dire, et l'utilisateur devrait connaître la liste exhaustive des feuilles.
- L'axe Business Capabilities a déjà résolu ce problème — arbre replié, recherche, comptage par nœud, expansion d'un parent coché. Rejouer le même modèle, plutôt qu'en inventer un autre, garde le panneau cohérent et divise le coût.

## Décisions (arbitrées)
- **Identité par `id` technique.** L'`externalId` est rapatrié et conservé dans le modèle mais n'est jamais utilisé comme clé, ni pour le filtrage, ni pour la persistance des filtres — il est nul en l'état.
- **Placement** : section « Data Objects » immédiatement après « Business Capabilities », dernière du panneau.
- **Mêmes comportements que l'axe capacités** : section repliée par défaut, état replié/déplié mémorisé, remise à plat par « Clear filters », compteur d'applications par nœud tenant compte des autres filtres actifs.
- **La requête est paginée** comme celle des capacités métier : les Data Objects peuvent être nombreux, et la requête fournie sans arguments de pagination ne ramènerait qu'une première page.
- **Le chargement de la hiérarchie est une ressource secondaire** : un échec de la requête masque la section, il ne doit jamais remplacer le catalogue par un écran d'erreur — comportement déjà en place pour les capacités.
- **Les règles défensives de construction d'arbre sont reprises telles quelles** : un nœud dont le parent est absent devient racine plutôt que de disparaître, et une chaîne de parents cyclique est rompue au nœud fautif.

## Requirements

### Functional Requirements

#### Données et hiérarchie
- Une requête dédiée rapatrie **tous** les Data Objects, page après page, avec pour chacun : `id`, `externalId`, `name`, `description`, le parent via `relToParent`, et les applications liées via `relDataObjectToApplication`.
- L'arbre est reconstruit côté client à partir des seuls liens vers le parent, les listes d'enfants étant déduites — même approche que pour les capacités métier, moitié moins de charge utile pour le même arbre.
- Un nom vide est remplacé par un tiret ; l'arbre est trié par nom à chaque niveau.
- La hiérarchie est chargée **en parallèle** des applications et partagée entre les vues, sans séquencement à écrire.
- Le bouton de rafraîchissement du catalogue invalide cette hiérarchie au même titre que les applications et les capacités.

#### Rattachement des applications
- Le filtrage doit savoir, pour chaque application, les Data Objects qui lui sont rattachés.
- Cette information existe **déjà** dans le modèle : l'application porte sa propre liste de Data Objects, alimentée par la relation inverse. Le choix de la source fait l'objet d'une question ouverte ci-dessous.
- Quelle que soit la source retenue, le rattachement est établi sur l'`id` technique.

#### Interface du filtre
- Section « Data Objects » placée après « Business Capabilities », repliable, avec le nombre de sélections actives affiché sur son en-tête comme les autres sections.
- À l'intérieur : un **champ de recherche** puis un **arbre de cases à cocher**.
- La recherche filtre les nœuds sur leur nom et **conserve les ancêtres** des correspondances, pour que les chemins restent parcourables.
- Chaque nœud affiche le **nombre d'applications** qu'il apporterait, compte tenu des autres filtres actifs — et non le total absolu.
- Un chevron déplie ou replie les nœuds ayant des enfants. L'état déplié et le texte de recherche sont **locaux** : ce ne sont pas des valeurs de filtre.
- Cocher un parent n'auto-coche pas visuellement ses enfants ; l'expansion est faite au filtrage.
- La section n'est pas rendue tant que la hiérarchie n'est pas chargée, ou si son chargement a échoué.

#### Filtrage
- La sélection est une liste d'`id`. Elle s'ajoute aux autres axes de façon **cumulative** : une application doit satisfaire tous les axes actifs.
- Une application est retenue si elle est rattachée à **au moins un** des Data Objects sélectionnés, descendance des nœuds cochés comprise.
- Sélection vide → l'axe n'exclut rien.
- Un changement de sélection remet la pagination du catalogue à la première page, comme tout autre changement de filtre.

#### Intégration au reste du panneau
- La sélection entre dans le **décompte des filtres actifs** (pastille du bouton mobile, compteur du panneau).
- « Clear filters » vide la sélection **et** replie l'arbre, comme pour les capacités.
- La sélection est mémorisée dans le même stockage de session que les autres filtres, avec la même validation de forme à la restauration : une valeur corrompue retombe sur une sélection vide.
- La sélection apparaît dans la **description textuelle des filtres**, celle qui alimente l'en-tête de l'export PDF, sous forme de **noms** et non d'identifiants.
- L'axe s'applique de la même façon au catalogue, à la carte et au panneau de filtres mobile.

### Non-Functional Requirements
- **Aucune dépendance nouvelle.**
- **Un seul appel réseau supplémentaire** (paginé), effectué en parallèle des autres chargements et mis en cache pour être partagé entre les pages.
- Un échec ou une lenteur de ce chargement **n'empêche ni le catalogue ni les autres filtres** de fonctionner.
- Le filtrage reste **côté client**, sur la liste déjà chargée, comme tous les autres axes.
- **Performance** : le comptage par nœud est recalculé à chaque changement des autres filtres ; il doit rester imperceptible sur un arbre de plusieurs centaines de nœuds.
- **Accessibilité** : cases à cocher et chevrons atteignables au clavier, section annonçant son état replié/déplié, champ de recherche étiqueté.
- **Thèmes** : clair et sombre, sans règle dédiée.

## Scope

### In Scope
- Requête GraphQL paginée sur les Data Objects et son type de réponse.
- Construction, tri et défense de l'arbre des Data Objects, expansion d'une sélection en descendance, comptage par nœud.
- Chargement en cache partagé, invalidé par le bouton de rafraîchissement.
- Nouvelle valeur de filtre (liste d'`id`), sa validation à la restauration et son décompte.
- Nouvelle section « Data Objects » dans le panneau de filtres, après « Business Capabilities », avec recherche et arbre.
- Prise en compte dans le filtrage partagé par le catalogue, la carte et le panneau mobile, ainsi que dans la description textuelle des filtres.
- Mémorisation de l'état replié/déplié de la nouvelle section.

### Out of Scope
- Utiliser l'`externalId` comme clé d'identité ou de persistance tant qu'il est nul.
- Afficher les Data Objects d'une application ailleurs que dans le filtre (la fiche application, le catalogue, la carte ne changent pas).
- Modifier les cartes d'identité de Discover, qui affichent déjà des Data Objects.
- Filtrer les **interfaces** ou les nœuds de Discover par Data Object.
- Un axe « Data Object » dans l'export PDF autre que la mention dans la description des filtres.
- Rendre les Data Objects cliquables, ou naviguer vers une fiche Data Object.
- Toute modification des requêtes Application, Interface ou Business Capability existantes.

## Affected Areas
- **Créer** :
  - la requête GraphQL des Data Objects et son constructeur paginé ;
  - le module de construction/exploitation de l'arbre des Data Objects (ou la généralisation de celui des capacités) ;
  - le hook de chargement de la hiérarchie, sur le modèle de celui des capacités ;
  - le composant d'arbre du filtre, si celui des capacités ne peut pas être réutilisé tel quel.
- **Modifier** :
  - `lib/atom-api.ts` — appel paginé et types de la réponse.
  - `lib/types.ts` — modèle du Data Object hiérarchisé.
  - `lib/appFilters.ts` — nouvelle valeur de filtre, défaut, validation, décompte.
  - `lib/applications.ts` — application de l'axe au filtrage.
  - `lib/useFilteredApplications.ts` — expansion de la sélection et comptage par nœud.
  - `components/FilterBar.tsx` — nouvelle section après Business Capabilities.
  - `lib/filterSectionState.ts` — nouvelle clé de section.
  - `lib/filterDescription.ts` — mention dans la description des filtres.
  - `components/CatalogueClient.tsx`, `components/MapClient.tsx`, `components/FilterSheet.tsx`, `components/FilterPanel.tsx`, `components/useApplicationActions.tsx` — passage de l'arbre, des comptes et de la sélection, sur le modèle exact des capacités.
  - `components/RefreshButton.tsx` — invalidation de la nouvelle ressource.
- **Non touché** : les requêtes Application / Interface / Business Capability, Discover et ses cartes, la fiche application, l'export PDF au-delà de sa ligne de description.

## Edge Cases
- **Data Object sans parent** : racine de l'arbre.
- **Parent absent du crawl** (page manquante, donnée incohérente) : le nœud devient racine plutôt que de disparaître.
- **Chaîne de parents cyclique** : rompue au nœud fautif, qui devient racine ; le parcours doit toujours se terminer.
- **Data Object rattaché à aucune application** : visible dans l'arbre avec un compte de zéro.
- **Application rattachée à aucun Data Object** : exclue dès qu'un nœud est coché.
- **Nom vide ou en blanc** : remplacé par un tiret, le nœud reste sélectionnable.
- **Doublons** dans la relation : une application ne doit être comptée qu'une fois par nœud.
- **Sélection portant sur un nœud disparu** entre deux chargements : elle ne correspond à rien et n'exclut pas tout le catalogue silencieusement — même tolérance que pour les autres axes, la valeur restaurée pouvant ne plus exister en amont.
- **Recherche sans résultat** : l'arbre est vide, avec un message, et non figé sur l'état précédent.
- **Hiérarchie très profonde** : l'indentation doit rester lisible et ne pas déborder de la largeur du panneau.
- **Crawl en échec** : la section n'est pas rendue, le reste du panneau fonctionne.
- **Sélection active puis échec du rafraîchissement** : le comportement doit rester cohérent, sans perte silencieuse du filtre affiché.

## Open Questions
- **Source du rattachement application ↔ Data Object** : s'appuyer sur la liste que **l'application porte déjà** (`relApplicationToDataObject`, déjà rapatriée et mappée), ou construire un index inverse à partir du `relDataObjectToApplication` du nouveau crawl ? Les deux sont les deux sens de la même relation LeanIX. Recommandation : **utiliser la liste déjà portée par l'application** — le pipeline de filtrage et de comptage devient rigoureusement identique à celui des capacités métier, sans second index à tenir cohérent. `relDataObjectToApplication` peut alors être **retiré de la requête**, ce qui l'allège d'autant. => suivre recommmendation

- **Généraliser l'arbre plutôt que le dupliquer** : la construction, l'expansion d'une sélection et le comptage par nœud sont, à la donnée près, ceux des Business Capabilities. Faut-il généraliser les modules existants, ou dupliquer pour ne pas toucher à un axe qui marche ? Recommandation : **généraliser**, y compris le composant d'arbre — deux copies de cette logique divergeront à la première correction. => suivre recommendation

- **Usage de la `description`** : rapatriée par la requête, mais l'arbre n'affiche que des noms. L'exposer en infobulle sur le nœud ? Recommandation : **oui, en infobulle**, c'est gratuit et cela lève les ambiguïtés de nommage entre Data Objects voisins. => suivre recommendation

- **Intitulé de la section** : « Data Objects » ou « Données » ? Recommandation : **« Data Objects »**, le panneau étant en anglais comme le reste de l'interface. => suivre recommendation

- **Application rattachée à un Data Object enfant quand le parent est coché** : retenue, par expansion — même règle que pour les capacités. À confirmer explicitement, car c'est ce qui rend la hiérarchie utile. => même règle que pour les capacités

## Acceptance Criteria
- [ ] Une section « Data Objects » apparaît dans le panneau de filtres, **immédiatement après** « Business Capabilities ».
- [ ] Elle contient un champ de recherche et un arbre de cases à cocher hiérarchisé, repliable niveau par niveau.
- [ ] La recherche filtre sur le nom et conserve les ancêtres des correspondances.
- [ ] Chaque nœud affiche le nombre d'applications qu'il apporterait compte tenu des **autres** filtres actifs.
- [ ] Cocher un nœud parent retient les applications rattachées à n'importe lequel de ses descendants.
- [ ] L'axe se cumule avec les autres filtres, et une sélection vide n'exclut rien.
- [ ] Un changement de sélection ramène le catalogue à la première page.
- [ ] La sélection entre dans le décompte des filtres actifs et dans la description textuelle des filtres, sous forme de noms.
- [ ] « Clear filters » vide la sélection et replie l'arbre.
- [ ] La sélection survit à un rechargement de l'onglet, et une valeur persistée corrompue retombe sur une sélection vide.
- [ ] L'identité des nœuds repose sur l'`id` technique ; aucun comportement ne dépend de l'`externalId`, nul aujourd'hui.
- [ ] La hiérarchie est rapatriée **entièrement**, pagination comprise.
- [ ] Un échec du chargement masque la seule section « Data Objects », sans écran d'erreur ni perte des autres filtres.
- [ ] Le filtre se comporte identiquement dans le catalogue, sur la carte et dans le panneau de filtres mobile.
- [ ] Le bouton de rafraîchissement recharge aussi cette hiérarchie.
- [ ] Aucune dépendance ajoutée, aucune modification des requêtes Application, Interface et Business Capability existantes.
