# Feature Spec: Icône Info et carte d'identité Application sur le graphe Discover

## Summary
- Sur chaque rectangle Application du graphe Discover (`onglet-discover-graphe-dependances-applications.md`), afficher une petite **icône "information"** en **bas à droite** du rectangle.
- Cliquer sur cette icône ouvre une **carte d'identité légère**, positionnée **à droite de l'icône**, affichant : **Nom de l'application**, **External Ref** (externalId), **Description**, **Category**, **Portfolio**, **Operator**.
- La carte se referme (au minimum) en recliquant sur l'icône ou en cliquant ailleurs sur le graphe — le comportement exact de fermeture et de gestion de plusieurs cartes ouvertes simultanément reste à trancher (cf. Open Questions).

## Motivation
- Le rectangle Application du graphe Discover n'affiche aujourd'hui, via l'icône réglages existante, que 3 attributs configurables (name, externalId, application manager) — volontairement minimal pour ne pas alourdir chaque nœud du graphe.
- Lors d'une exploration de dépendances, l'utilisateur a souvent besoin d'un rappel rapide de l'identité complète d'une application (à quoi elle sert, quel portfolio, quel opérateur) sans quitter le graphe ni rouvrir la fiche détail complète (`/application?id=...`) dans un autre onglet.
- Une carte contextuelle, ouverte à la demande et fermée par défaut, garde le rendu du graphe dense/lisible tout en rendant cette information accessible en un clic.

## Décisions (arbitrées)
- **Position de l'icône** : coin bas-droit du rectangle Application, visuellement distincte des poignées de redimensionnement (bords verticaux) et des cercles d'interface (bord haut/périmètre) déjà présents sur le même rectangle.
- **Déclenchement** : clic sur l'icône (pas de survol) — cohérent avec le choix déjà fait pour la mise en avant des liens (clic, pas hover).
- **Position de la carte** : à droite de l'icône, en overlay par-dessus le graphe (ne déplace pas le rectangle ni les autres nœuds).
- **Contenu de la carte** : exactement les 6 champs listés — Nom Application, External Ref, Description, Category, Portfolio, Operator. Pas d'action ni de lien cliquable pour cette itération (cf. Out of Scope).
- **Source des données** : les mêmes données déjà chargées pour peupler le graphe (catalogue `Application[]` via `useApplications`, déjà utilisé pour la recherche et la résolution de l'attribut manager) — aucun nouvel appel réseau, la carte est "légère" au sens where elle ne déclenche aucun fetch supplémentaire.

## Requirements

### Functional Requirements
- Chaque rectangle Application affiché sur le graphe Discover porte une icône "information" en bas à droite.
- Cliquer sur l'icône affiche une carte contenant Nom Application, External Ref, Description, Category, Portfolio, Operator, positionnée à droite de l'icône.
- Un champ vide/non renseigné s'affiche de façon cohérente avec le reste de l'application (repli explicite, ex. "—"), jamais une valeur `null`/`undefined` brute.
- La carte n'interfère pas avec les interactions existantes du rectangle (déplacement, redimensionnement par les bords, clic de mise en avant des liens, clic droit pour le menu contextuel, cercles d'interface).

### Non-Functional Requirements
- Aucune dépendance npm nouvelle.
- Aucun appel réseau supplémentaire déclenché par l'ouverture de la carte.
- Cohérence visuelle avec les tokens `--color-*` existants, lisible en thème clair et sombre.

## Scope

### In Scope
- Icône "information" sur chaque rectangle Application du graphe Discover.
- Carte d'identité légère affichée au clic, avec les 6 champs listés.

### Out of Scope
- Navigation depuis la carte vers la fiche détail complète de l'application (`/application?id=...`) — non demandé, pourrait être une itération ultérieure.
- Édition des champs affichés.
- Affichage de la carte pour un nœud Interface (uniquement les rectangles Application sont concernés).
- Persistance de l'état "carte ouverte" entre deux sessions ou après un rechargement de page.

## Affected Areas
- **Modifier** : `components/discover/ApplicationNode.tsx` (icône + déclenchement) et/ou un nouveau petit composant de carte dédié dans `components/discover/`.
- **Modifier éventuellement** : `components/discover/DiscoverGraph.tsx` si l'état "quelle carte est ouverte" doit être géré au niveau du graphe plutôt que localement dans chaque nœud (cf. Open Questions).
- **Non touché** : `lib/discover-graph-adapter.ts`, requêtes GraphQL (`lib/leanix-interface-query.ts`, `lib/atom-api.ts`) — aucune nouvelle donnée à récupérer, tout provient du catalogue `Application[]` déjà chargé par `DiscoverClient` (`lib/useApplications.ts`).

## Edge Cases
- **Application affichée sur le graphe mais absente du catalogue local** (cas théorique — cf. edge cases déjà documentés ailleurs pour les applications révélées via les interfaces) → la carte affiche les champs disponibles (au minimum ceux déjà portés par le nœud : nom, externalId) et un repli "—" pour Description/Category/Portfolio/Operator plutôt qu'une erreur.
- **Nom ou description très longs** → la carte doit rester lisible (troncature avec ellipse ou retour à la ligne, à trancher au plan) sans déborder de façon incontrôlée sur le reste du graphe.
- **Carte ouverte près du bord droit du canevas** → risque de déborder hors de la zone visible du graphe (à traiter au plan : repositionnement automatique ou simple superposition assumée pour cette itération).
- **Rectangle redimensionné (largeur variable, cf. plan de redimensionnement)** → l'icône reste ancrée au coin bas-droit réel du rectangle, quelle que soit sa largeur courante.
- **Plusieurs cartes ouvertes simultanément sur plusieurs applications différentes** → comportement à trancher (cf. Open Questions).

## Open Questions
- **Fermeture de la carte** : se ferme-t-elle uniquement en recliquant sur l'icône, ou aussi en cliquant ailleurs sur le canevas (comme le fait la mise en avant des liens) ou en appuyant sur Échap ?
=> les 3

- **Cartes multiples** : peut-on avoir plusieurs cartes d'identité ouvertes en même temps (une par application), ou l'ouverture d'une nouvelle carte doit-elle fermer automatiquement la précédente (une seule carte visible à la fois) ?
=> une seule carte visible à a fois

- **Interaction avec le clic de mise en avant des liens** : cliquer sur l'icône doit-il aussi déclencher (ou au contraire ne jamais déclencher) la mise en avant des liens de cette application, sachant que l'icône est positionnée à l'intérieur du rectangle ?=> non pas de mise en avant

- **Format de la Description** : si elle est longue, faut-il la tronquer avec une longueur maximale fixe, ou laisser la carte s'agrandir verticalement sans limite ? => mettre un slide permettant de parcourir la description, mais la taille de la carte reste identique pour toutes

## Acceptance Criteria
- [ ] Une icône "information" est visible en bas à droite de chaque rectangle Application du graphe Discover.
- [ ] Cliquer sur l'icône affiche une carte à sa droite avec Nom Application, External Ref, Description, Category, Portfolio, Operator.
- [ ] Les champs non renseignés affichent un repli explicite, jamais une valeur brute vide.
- [ ] La carte n'empêche pas les interactions existantes du rectangle (déplacement, redimensionnement, clic de mise en avant, clic droit, cercles d'interface).
- [ ] Aucun appel réseau supplémentaire n'est déclenché par l'ouverture de la carte.
- [ ] Aucune dépendance npm ajoutée.
- [ ] Build Next OK (`npm run build`).
