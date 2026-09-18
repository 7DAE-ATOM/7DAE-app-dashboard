# Feature Spec: Densité d'Affichage du Catalogue — Colonnes et Lignes par Page

## Summary
- Rendre paramétrable la densité de la grille du catalogue `/`, aujourd'hui figée à **6 cards par page** et **1 / 2 / 3 colonnes** selon le breakpoint.
- Deux réglages complémentaires, exposés à l'utilisateur :
  1. **Nombre de cards par ligne** : `3`, `5` ou `8` — trois paliers seulement, pas un curseur libre. Plus il y a de colonnes, plus les cards sont petites (la largeur de card est déduite de la grille, pas fixée).
  2. **Nombre de lignes par page** : sélecteur placé **à côté des contrôles de pagination**, en bas de la grille.
- La taille de page devient un produit : **`pageSize = colonnes × lignes`**. Conséquence voulue : la dernière ligne d'une page est toujours pleine (sauf la toute dernière page du jeu de résultats), la grille ne « saute » jamais.
- Les deux réglages forment une **préférence utilisateur persistante** (survit au rechargement et à la fermeture de l'onglet), distincte des filtres et jamais réinitialisée par « Clear filters ».
- Le réglage de colonnes ne s'applique qu'en desktop (`lg` et au-delà). En dessous, la grille reste à 1 puis 2 colonnes et le contrôle correspondant est masqué — 8 cards par ligne sur un téléphone n'a pas de sens.
- Scope limité au catalogue `/`. La carte `/map`, la fiche application et `/discover` ne sont pas concernées.

## Motivation
- Le catalogue affiche plusieurs centaines d'applications ; **6 cards par page** impose une navigation en dizaines de pages pour un simple survol du parc.
- Les usages sont hétérogènes et inconciliables avec une valeur unique :
  - **Balayage large** (« qu'est-ce qu'il y a dans ce portfolio ? ») → on veut beaucoup de petites vignettes, 8 par ligne, plusieurs lignes.
  - **Lecture attentive** (démo, revue d'un périmètre restreint) → on veut de grandes cards lisibles, 3 par ligne.
  - Les écrans vont du portable 13" au moniteur 32" : une grille figée à 3 colonnes gaspille la moitié d'un grand écran.
- Trois paliers (3 / 5 / 8) plutôt qu'un réglage continu : chaque palier correspond à une intention d'usage identifiable, ce qui évite un réglage à six valeurs dont l'utilisateur ne perçoit pas la différence.
- Lier `pageSize` aux colonnes (au lieu d'une liste indépendante 6 / 12 / 24) supprime la classe de défauts visuels la plus visible : une dernière ligne orpheline de 2 cards sur une grille de 8.
- La spec `pagination-du-catalogue.md` avait explicitement renvoyé le sélecteur de taille de page à plus tard (« Out of Scope : sélecteur 6 / 12 / 24, peut arriver en V2 »). C'est cette V2, avec un modèle colonnes × lignes au lieu d'une liste plate.

## Requirements

### Functional Requirements

#### Réglage « cards par ligne »
- Trois valeurs possibles, exclusives : **3**, **5**, **8**. Valeur par défaut : **3** (correspond à la grille desktop actuelle, donc aucun changement visuel pour un utilisateur qui ne touche à rien).
- Le contrôle prend la forme d'un sélecteur segmenté (trois options côte à côte, l'option active mise en avant), placé **au-dessus de la grille, aligné à droite**, dans une barre d'outils d'affichage.
- L'option active est identifiable sans recours à la couleur seule (état visuel + état ARIA).
- Le changement est **immédiat**, sans rechargement ni appel réseau.
- Le réglage n'a d'effet qu'à partir du breakpoint `lg`. En dessous : 1 colonne en mobile, 2 en tablette, comme aujourd'hui ; le sélecteur est masqué.
- La largeur des cards n'est pas fixée : les colonnes se partagent la largeur disponible à parts égales, gouttières comprises. Une même valeur de colonnes donne donc des cards plus larges sur un écran plus large.

#### Adaptation de la card à la densité
- À 3 colonnes : la card est rendue telle qu'aujourd'hui (visuel 4:3, titre sur 2 lignes maximum, chips catégorie / criticité, ligne de méta secondaire).
- À 5 colonnes : rendu identique, seule la taille change. La troncature du titre reste à 2 lignes.
- À 8 colonnes : la card passe en **variante compacte** — titre sur 1 ligne, ligne de méta secondaire masquée, chips conservées mais resserrées. Objectif : à ~180–220 px de large, la card doit rester lisible et cliquable, pas devenir un pavé tronqué de partout.
- Le seuil de bascule en variante compacte est une caractéristique de la densité, pas une décision prise dans la card : la grille indique à la card dans quel mode elle est rendue.
- Le visuel de couverture conserve son ratio 4:3 dans les trois modes — c'est ce qui garantit que les lignes restent alignées.

#### Réglage « lignes par page »
- Sélecteur placé **à côté des contrôles de pagination**, en bas de la grille, sur la même ligne que le compteur `Showing X–Y of Z`.
- Libellé explicite (ex. « Rows per page ») associé au contrôle, pas une icône seule.
- Valeurs proposées : **2, 3, 4, 6**. Valeur par défaut : **4**.
- Avec les défauts (3 colonnes × 4 lignes), la page affiche **12 applications** au lieu de 6 aujourd'hui. C'est un changement assumé : 6 est trop peu pour le volume réel du parc.

#### Taille de page dérivée
- `pageSize = colonnes × lignes`, recalculé à chaque changement de l'un des deux réglages.
- Combinaisons possibles : de `3 × 2 = 6` à `8 × 6 = 48` applications par page.
- Sous `lg`, le nombre de colonnes réellement affichées (1 ou 2) ne modifie **pas** `pageSize` : la taille de page reste celle du réglage. Autrement dit, la même URL `?page=3` désigne le même bloc d'applications quel que soit l'appareil ; une page mobile affiche simplement plus de lignes.
- Le nombre total de pages se recalcule sur la liste **filtrée** : `totalPages = ceil(filteredCount / pageSize)`.

#### Conservation de la position lors d'un changement de densité
- Changer les colonnes ou les lignes ne doit **pas** ramener brutalement à la page 1.
- Règle : le **premier élément visible avant le changement reste visible après**. La nouvelle page est celle qui contient cet élément.
- Si la nouvelle taille de page rend la page courante hors plage (cas d'un fort agrandissement de `pageSize`), la page est ramenée dans la plage, sans page vide ni écran blanc.
- L'URL `?page=N` est mise à jour en conséquence, avec le même comportement que l'existant (`page=1` omis, remplacement de l'entrée d'historique plutôt qu'ajout).

#### Persistance de la préférence
- Les deux réglages sont mémorisés **durablement** côté navigateur, au même titre que le thème clair/sombre et les réglages du cache photos — et non comme les filtres, qui ne survivent qu'à la session.
- Justification : c'est une préférence d'ergonomie liée à l'écran de l'utilisateur, pas un état de recherche. Un utilisateur qui préfère 8 colonnes le préfère encore demain.
- « Clear filters » **ne réinitialise pas** la densité.
- Les réglages ne sont **pas** portés par l'URL. `?page=` reste le seul paramètre de la vue catalogue, et `?id=` celui de la fiche — la convention d'URL propre du projet est préservée.
- Une valeur persistée corrompue ou hors des valeurs autorisées (colonnes autres que 3/5/8, lignes hors 2/3/4/6) retombe silencieusement sur les défauts.

#### Cohérence de l'état de chargement
- L'écran squelette du catalogue affiche **le même nombre de colonnes et de lignes** que le réglage courant. Sinon chaque chargement produit un saut de mise en page au moment où les données arrivent.

#### Apparence
- Les deux contrôles utilisent les tokens de couleur existants (`--color-accent`, `--color-border`, `--color-fg`, `--color-surface`, `--color-muted`) et fonctionnent en mode clair comme en mode sombre sans règle dédiée.
- Ils reprennent le vocabulaire visuel des boutons de pagination existants (pilules bordées, accent pour l'état actif), pour que la barre du bas se lise comme un ensemble.

### Non-Functional Requirements
- Aucune dépendance externe, aucun appel API supplémentaire : tout reste du découpage client d'une liste déjà chargée.
- Le changement de densité doit être perçu comme instantané (pas de spinner, pas de re-fetch).
- Passer de 6 à 48 cards par page augmente mécaniquement le coût de rendu : la variante compacte doit rester légère, et le rendu à 48 cards doit rester fluide sur un portable de gamme moyenne.
- Accessibilité :
  - Les deux contrôles sont atteignables au clavier et annoncent leur valeur courante.
  - Le sélecteur de lignes est associé à un libellé visible.
  - Le compteur `Showing X–Y of Z` est annoncé aux lecteurs d'écran lorsqu'il change.
  - Aucun réglage ne dépend de la perception de la couleur seule.
- La logique de densité est isolée dans un module dédié, pour qu'une autre vue puisse la lire plus tard sans duplication.

## Scope

### In Scope
- Un **store de préférence d'affichage du catalogue** (colonnes + lignes), persistant, suivant le même modèle que les préférences existantes (thème, cache photos).
- Un **sélecteur de colonnes** (3 / 5 / 8) dans une barre d'outils au-dessus de la grille, masqué sous `lg`.
- Un **sélecteur de lignes par page** intégré à la zone de pagination.
- Modification de la grille du catalogue pour rendre le nombre de colonnes dynamique au-delà de `lg`.
- Modification de la card application pour supporter une **variante compacte** activée à 8 colonnes.
- Modification du calcul de pagination du catalogue : `pageSize` dérivé, recalcul de la page courante à la volée.
- Alignement du squelette de chargement sur le réglage courant.

### Out of Scope
- Pagination côté serveur — la liste complète continue d'être chargée en une fois.
- Application de la densité à `/map`, `/discover` ou à la fiche application.
- Valeurs de colonnes autres que 3 / 5 / 8, ou réglage continu par curseur.
- Réglage automatique du nombre de colonnes selon la largeur réelle de la fenêtre (auto-fit) : le choix reste explicite.
- Passage des réglages dans l'URL ou partage d'un lien portant une densité.
- Synchronisation de la préférence entre navigateurs ou entre utilisateurs (pas de persistance serveur).
- Basculement vers un affichage en liste / tableau — c'est un autre sujet que la densité.
- Scroll-to-top au changement de densité ou de page (le comportement actuel, sans scroll, est conservé).

## Affected Areas
- **Créer** :
  - Un module de préférence de densité du catalogue sous `lib/` (valeurs autorisées, défauts, lecture/écriture persistante, hook de lecture réactif).
  - Un composant de sélecteur segmenté pour les colonnes, dans `components/`.
- **Modifier** :
  - `components/CatalogueClient.tsx` — lecture de la densité, suppression de la constante `PAGE_SIZE` figée, `pageSize` dérivé, recalcul de la page lors d'un changement de densité, colonnes de grille dynamiques, barre d'outils au-dessus de la grille, squelette aligné sur le réglage.
  - `components/Pagination.tsx` — accueil du sélecteur « lignes par page » à côté du compteur. Attention : le composant se masque entièrement quand il n'y a qu'une page ; le sélecteur doit rester accessible dans ce cas.
  - `components/ApplicationCard.tsx` — variante compacte.
- **Non touché** :
  - `lib/appFilters.ts` — la densité n'est pas un filtre et ne partage pas son stockage de session.
  - `lib/usePageQuery.ts` — le contrat `?page=N` reste identique ; seul l'appelant change la taille de page.
  - `lib/useApplications.ts`, `lib/useFilteredApplications.ts`, la couche API et l'adapter — aucune notion de densité côté données.
  - `components/MapClient.tsx`, `components/MapView.tsx`, `components/DiscoverClient.tsx`, la fiche application.
  - `FilterPanel` / `FilterSheet` — ils ignorent la densité ; le réglage vit dans la barre d'affichage et la pagination.

## Edge Cases
- **Aucun résultat** : message vide existant, aucun contrôle de pagination. Le sélecteur de colonnes reste visible (il ne dépend pas des résultats) ; celui des lignes n'a rien à paginer.
- **Moins d'une page de résultats** : pagination masquée comme aujourd'hui, mais le sélecteur de lignes doit rester atteignable — sinon un utilisateur ayant réglé 6 lignes ne peut plus redescendre.
- **Dernière page incomplète** : la ligne finale est partiellement remplie ; les cards restent alignées à gauche, sans étirement pour combler le vide.
- **Passage de 8 à 3 colonnes en page 9** : la page est recalculée pour garder la première application visible ; on n'atterrit ni page 1 ni sur une page vide.
- **Passage de 2 à 6 lignes sur la dernière page** : la nouvelle page est ramenée à `totalPages`.
- **Réglage 8 colonnes puis passage sur mobile** : la grille retombe à 1 colonne, le sélecteur disparaît, `pageSize` reste inchangé — la page devient simplement longue.
- **Fenêtre redimensionnée en direct** à travers le breakpoint `lg` : le sélecteur apparaît / disparaît, la page courante ne bouge pas.
- **Valeur persistée invalide ou stockage indisponible** (navigation privée, stockage bloqué) : retour silencieux aux défauts, aucun message d'erreur.
- **Premier rendu** : la densité persistée doit être appliquée dès le squelette, pour éviter un passage visible de 3 à 8 colonnes après hydratation.
- **Titre très long à 8 colonnes** : troncature sur une ligne avec ellipsis, jamais de débordement ni de card plus haute que ses voisines.
- **Retour depuis la fiche application** (« Back to catalog » avec `?page=N`) : la densité persistée est celle d'avant, donc la page restaurée désigne bien le même bloc d'applications.

## Open Questions
- **Valeurs de lignes par page** : 2 / 3 / 4 / 6 proposé. Faut-il une option plus haute (8, 10) pour l'usage « balayage » à 8 colonnes, qui donnerait 64–80 cards par page ? Recommandation : non en V1, plafonner à 48 pour préserver la fluidité du rendu. => suivre recommendation

- **Emplacement du sélecteur de colonnes** : barre d'outils au-dessus de la grille (proposé) ou section « DISPLAY » dans le panneau de filtres de gauche ? Recommandation : au-dessus de la grille, pour ne pas laisser croire que c'est un filtre. => suivre recommendation

- **Icônes ou chiffres** pour le sélecteur de colonnes ? Recommandation : les chiffres `3 / 5 / 8`, sans ambiguïté, éventuellement accompagnés d'un petit pictogramme de grille. => suivre recommendation

- **Changement de densité et historique navigateur** : le recalcul de page réutilise-t-il le remplacement d'entrée comme la pagination actuelle ? Recommandation : oui, cohérence avec l'existant. => suivre recommendation

- **Défaut à 3 colonnes / 4 lignes (12 par page)** convient-il, ou faut-il conserver 6 par page pour ne rien changer au premier contact ? Recommandation : 12, le volume du parc rend 6 trop peu. => suivre recommendation

- **Variante compacte à 5 colonnes** : faut-il déjà y basculer, ou seulement à 8 ? Recommandation : seulement à 8, à confirmer visuellement sur un écran 24". => seulement à 8

## Acceptance Criteria
- [ ] Le catalogue expose un sélecteur `3 / 5 / 8` cards par ligne, visible uniquement à partir du breakpoint `lg`.
- [ ] Le catalogue expose un sélecteur « lignes par page » (2 / 3 / 4 / 6) situé à côté des contrôles de pagination.
- [ ] La grille affiche exactement le nombre de colonnes choisi sur écran large, et les cards se redimensionnent en conséquence.
- [ ] Le nombre d'applications affichées par page vaut toujours `colonnes × lignes`, sauf sur la dernière page du jeu de résultats.
- [ ] À 8 colonnes, la card bascule en variante compacte : titre sur une ligne, méta secondaire masquée, aucune troncature illisible ni débordement.
- [ ] Sous `lg`, la grille reste à 1 puis 2 colonnes et le sélecteur de colonnes est masqué, sans changer la taille de page.
- [ ] Changer l'un des deux réglages conserve la première application visible à l'écran ; on n'est jamais renvoyé à la page 1 ni sur une page vide.
- [ ] L'URL `?page=N` reste cohérente après un changement de densité, avec `page=1` toujours omis et aucune entrée superflue dans l'historique.
- [ ] Les deux réglages sont conservés après rechargement de la page **et** après fermeture puis réouverture de l'onglet.
- [ ] « Clear filters » ne modifie pas la densité.
- [ ] Une valeur persistée invalide ou un stockage indisponible retombe sur les défauts sans erreur visible.
- [ ] Le squelette de chargement affiche la même grille que le réglage courant : aucun saut de mise en page à l'arrivée des données.
- [ ] Le sélecteur de lignes reste utilisable quand le résultat tient sur une seule page.
- [ ] Les deux contrôles sont pilotables au clavier, annoncent leur valeur active, et fonctionnent en mode clair comme en mode sombre sans ajustement CSS spécifique.
- [ ] Aucun appel réseau supplémentaire, aucune modification de l'API ni de l'adapter ; `/map`, `/discover` et la fiche application sont inchangés.
