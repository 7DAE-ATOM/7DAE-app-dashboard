# Feature Spec: Persistance des Filtres du Catalogue à la Navigation Détail

## Summary
- Mémoriser les filtres appliqués au catalogue lorsqu'un utilisateur ouvre la fiche détail d'un lab test mean.
- Au clic sur **« Back to catalog »** depuis la fiche détail → revenir au catalogue **avec les filtres précédemment appliqués** (et idéalement la même page).
- Au clic sur le menu **« Catalogue »** (Header) → **réinitialiser tous les filtres** (retour à l'état non filtré).
- Objectif : conserver le contexte de recherche lors d'un aller-retour catalogue → détail → catalogue, tout en offrant une remise à zéro explicite via le menu.

## Motivation
Aujourd'hui les filtres du catalogue vivent dans un état **local** au composant (`CatalogueClient` → `CatalogueLoaded`, `useState` `filters`) et **ne sont pas persistés**. Conséquence : dès qu'on quitte le catalogue pour la fiche détail, l'état des filtres est perdu ; le retour réaffiche le catalogue **sans filtre**, obligeant l'utilisateur à tout re-saisir.

Les deux points d'entrée vers le catalogue pointent actuellement vers la même URL `/` sans distinction d'intention :
- **« Back to catalog »** sur la fiche détail (`components/LabTestMeanDetailClient.tsx`, `<Link href="/">`).
- **« Catalogue »** dans le menu (`components/Header.tsx`, `<Link href="/">`).

Il faut donc différencier ces deux intentions : l'une **restaure** les filtres, l'autre les **efface**.

## Requirements

### Functional Requirements

#### 1. Mémorisation des filtres à l'ouverture du détail
- Quand l'utilisateur clique sur une carte (ou un lien de détail depuis la carte/map) pour ouvrir une fiche, les filtres du catalogue **en cours** doivent être mémorisés.
- Les filtres concernés sont l'ensemble actuel : `search`, `types`, `statuses`, `countries`, `programNodeIds`, `complexities`, `portfolios`.
- La **page de pagination** courante (`?page=`) devrait également être mémorisée pour revenir au même endroit (cf. Open Questions).

#### 2. « Back to catalog » → restauration des filtres
- Le lien **« Back to catalog »** de la fiche détail doit ramener au catalogue **avec les filtres mémorisés** ré-appliqués (résultats filtrés identiques à avant l'ouverture de la fiche).
- Si possible, restaurer aussi la **page** sur laquelle l'utilisateur se trouvait.
- Si aucun filtre n'était appliqué, le comportement est identique à aujourd'hui (catalogue complet).

#### 3. Menu « Catalogue » → réinitialisation
> **Remplacé** par `filtres-partages-catalogue-carte-et-lien-clear.md` : le menu « Catalogue » n'efface plus rien, l'effacement passe par le lien « Clear All » du panneau. De même, la réponse « état en mémoire, perdu au rechargement » de la première Open Question est remplacée : les filtres sont désormais mémorisés en `sessionStorage` et partagés avec la carte.

- ~~Le lien **« Catalogue »** du Header doit **toujours** afficher le catalogue **sans aucun filtre** (état par défaut), même si des filtres avaient été mémorisés.~~
- ~~Ce clic **efface** la mémorisation des filtres (un retour ultérieur via « Back to catalog » ne doit pas ré-appliquer d'anciens filtres effacés).~~

#### 4. Distinction claire des deux intentions
- Les deux entrées mènent au catalogue mais avec des comportements opposés (restaurer vs effacer). La solution doit différencier sans ambiguïté « retour depuis le détail » et « accès via le menu ».

### Non-Functional Requirements
- **Aucune régression** sur le filtrage, la pagination, la carte, l'export PDF.
- Compatible avec l'export statique (`output: "export"`, SPA nginx) — pas de dépendance à un serveur.
- Cohérent avec la gestion d'URL propre du projet (`/`, `/map`, `/labtestmean?id=…`) : ne pas introduire de segment de route superflu.

## Scope

### In Scope
- Persistance/restauration des filtres du **catalogue** lors de l'aller-retour vers la fiche détail.
- Réinitialisation des filtres au clic sur le menu « Catalogue ».
- Restauration optionnelle de la page de pagination.

### Out of Scope
- Les filtres de la **carte** (`MapClient`) — état distinct, non concerné par cette demande.
- Le partage d'un état filtré via une URL copiable/bookmarkable (sauf si l'approche URL est retenue, cf. Open Questions).
- Tout changement de design visuel du catalogue ou de la barre de filtres.

## Affected Areas
- `components/CatalogueClient.tsx` : source de l'état `filters` — initialisation depuis l'état mémorisé, et réinitialisation sur intention « menu ».
- `components/LabTestMeanDetailClient.tsx` : le lien « Back to catalog » doit porter l'intention « restaurer ».
- `components/Header.tsx` : le lien « Catalogue » doit porter l'intention « effacer ».
- `components/LabTestMeanCard.tsx` / `components/MapView.tsx` : éventuellement, capter/mémoriser les filtres au moment d'ouvrir une fiche (selon l'approche).
- `lib/usePageQuery.ts` : si la page de pagination est également mémorisée/restaurée.
- Éventuel petit module/contexte de persistance des filtres (selon l'approche retenue).

## Edge Cases
- **Accès direct au catalogue par URL** (sans venir d'une fiche) → aucun filtre (état par défaut).
- **Rechargement de la page détail puis « Back to catalog »** : selon le médium de persistance choisi (mémoire vive vs `sessionStorage` vs URL), les filtres peuvent ou non survivre à un reload — comportement à arbitrer (cf. Open Questions).
- **Lien de détail ouvert dans un nouvel onglet** : le contexte de filtre du premier onglet peut ne pas être disponible — dégrader proprement (catalogue non filtré).
- **Filtres mémorisés devenus invalides** (ex. un `programNodeId` qui n'existe plus après refresh des données) : ignorer silencieusement les valeurs obsolètes, ne pas planter.
- **Navigation détail → détail** (lien « depends on ») puis « Back to catalog » : restaurer les filtres d'origine du catalogue, pas un état intermédiaire.
- Cohérence avec la **pagination** : si la page mémorisée dépasse le nombre de pages après restauration des filtres, retomber sur une page valide.

## Open Questions
- **Médium de persistance** : état en mémoire (contexte/module — perdu au reload), `sessionStorage` (survit au reload de l'onglet), ou **paramètres d'URL** sur le lien « Back to catalog » (filtres encodés dans l'URL de retour) ? L'option URL est la plus robuste et alignée avec le reste du projet, mais alourdit l'URL. => état en mémoire, perdu au releoad
- **Pagination** : faut-il aussi restaurer la page courante en plus des filtres ? => oui
- **Effacement** : le menu « Catalogue » doit-il aussi remettre la pagination à la page 1 (en plus d'effacer les filtres) ? =>  oui
- **Portée temporelle** : la mémorisation doit-elle persister toute la session, ou seulement pour l'aller-retour immédiat détail → catalogue ? => retour immédiat

## Acceptance Criteria
- [ ] Appliquer des filtres au catalogue, ouvrir une fiche détail, cliquer « Back to catalog » → le catalogue réaffiche **exactement** les mêmes filtres et résultats.
- [ ] Depuis ce même état, cliquer le menu « Catalogue » → le catalogue s'affiche **sans aucun filtre**.
- [ ] Après un clic sur le menu « Catalogue », un retour ultérieur ne ré-applique pas d'anciens filtres effacés.
- [ ] Accès direct au catalogue par URL → aucun filtre.
- [ ] (Si retenu) la page de pagination est restaurée avec les filtres au « Back to catalog ».
- [ ] Aucune régression : filtrage, pagination, carte, export PDF, fiche détail fonctionnent comme avant.
- [ ] `npm run build` passe sans erreur (export statique préservé).
