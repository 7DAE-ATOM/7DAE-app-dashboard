# Feature Spec: Aperçu du nombre de résultats au survol d'un bouton de filtre

## Summary
- Dans le panneau de filtres du catalogue, survoler un bouton d'option (Category, Status, Portfolio, Business Criticality) affiche le **nombre d'applications qui resteraient visibles si l'on cliquait dessus**, c'est-à-dire le filtre courant **plus** (ou moins) cette option.
- L'aperçu tient compte du clic réel : sur une option **inactive**, il montre le résultat de son activation ; sur une option **déjà active**, il montre le résultat de sa désactivation.
- Objectif : supprimer le tâtonnement « je clique, je regarde le compteur, je reviens en arrière ».

## Motivation
- Le panneau ne dit rien de l'effet d'un filtre avant qu'on l'applique. L'utilisateur clique, lit le compteur « N / M applications », puis annule s'il ne trouve pas ce qu'il cherchait — sur un catalogue de plusieurs centaines d'applications, c'est plusieurs allers-retours par recherche.
- Certaines combinaisons donnent **zéro résultat**, et rien ne le laisse deviner à l'avance : l'aperçu les rend visibles sans les subir.
- Le principe est déjà acquis dans le panneau : l'arbre Business Capabilities affiche un compte par nœud (`countApplicationsPerNode`, `lib/businessCapabilities.ts`). Cette spec étend la même idée aux chapitres à boutons, avec une nuance importante : ici le compte est **contextuel au filtre courant**, pas un total absolu.

## Décisions (arbitrées)

### Sémantique du nombre affiché
- Le nombre est le résultat de `filterApplications` appliqué au **filtre qui serait en vigueur après le clic**, tous chapitres confondus — pas le nombre d'applications portant cette valeur dans l'absolu.
- Conséquence à assumer, qui découle de la logique de filtrage existante (`lib/applications.ts`) : à l'intérieur d'un chapitre les options sont en **OU**, entre chapitres en **ET**. Donc :
  - activer la **première** option d'un chapitre vide **réduit** le nombre ;
  - activer une option **supplémentaire** dans un chapitre déjà actif **augmente** le nombre (élargissement de l'union) ;
  - désactiver la **dernière** option active d'un chapitre **augmente** le nombre (le chapitre cesse de filtrer).
  L'aperçu doit rester juste dans ces trois cas, ce qui interdit de le calculer comme un simple « combien d'applications ont cette valeur ».

### Portée des contrôles concernés
- Les chapitres à boutons d'option : **Category, Status, Portfolio, Business Criticality**.
- L'arbre Business Capabilities garde son compteur actuel (non contextuel) — l'aligner sur la même sémantique est un sujet distinct.
- Le commutateur Photo, les champs de recherche et le champ Operator ne sont pas concernés.

### Déclenchement et affichage
- Au **survol** et au **focus clavier** du bouton, pour que la fonctionnalité ne soit pas réservée à la souris.
- Le nombre s'affiche de façon discrète et **sans provoquer de décalage de mise en page** : le libellé de l'option ne doit pas bouger quand l'aperçu apparaît.
- Forme exacte (nombre à l'intérieur du bouton, ou info-bulle à la manière de celles de la rangée ACTIONS) — voir Open Questions.

## Requirements

### Functional Requirements
- Survoler ou focaliser un bouton d'option d'un chapitre de filtre affiche le nombre d'applications qui seraient visibles après le clic sur ce bouton.
- Le calcul applique la même fonction de filtrage que l'affichage réel, pour qu'aperçu et résultat ne puissent jamais diverger.
- L'aperçu tient compte de tous les autres critères actifs (recherche, operator, photo, capacités métier, autres chapitres).
- L'aperçu reflète le sens du clic : activation pour une option inactive, désactivation pour une option active.
- Quitter le survol / le focus fait disparaître l'aperçu, sans laisser de valeur figée.

### Non-Functional Requirements
- **Aucun appel réseau** : tout est calculé sur la liste déjà chargée côté client.
- **Pas de latence perceptible** au survol : le calcul est linéaire sur la liste, mais il ne doit pas être relancé inutilement à chaque rendu (mémoïsation, ou calcul au survol uniquement).
- **Pas de décalage visuel** ni de changement de taille du bouton à l'apparition du nombre.
- Lisible en thème clair et sombre, via les tokens `--color-*`.
- Accessibilité : le nombre doit être annonçable (ou au minimum ne pas perturber la lecture du libellé) et l'aperçu ne doit pas capturer le pointeur.
- Comportement identique dans le panneau mobile (`FilterSheet`), qui rend le même composant.

## Scope

### In Scope
- Calcul contextuel du nombre de résultats pour chaque option des quatre chapitres à boutons.
- Affichage au survol et au focus, dans le panneau desktop et mobile.

### Out of Scope
- Alignement de l'arbre Business Capabilities sur cette sémantique contextuelle.
- Aperçu pour le commutateur Photo, la recherche et le champ Operator.
- Affichage permanent des compteurs (sans survol) sur chaque option.
- Grisage ou masquage automatique des options menant à zéro résultat.
- La vue `/map`, qui partage le composant de filtres mais n'est pas visée par cette itération (à vérifier au plan pour éviter une régression).

## Affected Areas
- **Modifier** : `components/FilterBar.tsx` — le composant `Toggle` interne, qui rend tous les boutons d'option des quatre chapitres.
- **Réutiliser** : `filterApplications` (`lib/applications.ts`) — source de vérité du filtrage, à ne surtout pas réimplémenter.
- **À vérifier** : `components/CatalogueClient.tsx` (c'est lui qui détient la liste complète des applications et applique les filtres) et `components/MapClient.tsx`, qui rend aussi `FilterBar` avec un autre jeu de données.
- **À vérifier** : `components/FilterSheet.tsx`, qui délègue à `FilterBar` — la feature doit y fonctionner sans travail supplémentaire.
- **Non touché** : `components/CapabilityTreeFilter.tsx`, les cartes du catalogue, la pagination.

## Edge Cases
- **Aperçu à 0** → affiché tel quel ; c'est précisément l'information utile. Une mise en évidence discrète est envisageable, non tranchée.
- **Option déjà active** → l'aperçu montre le résultat du retrait, qui est en général plus grand que le nombre courant.
- **Dernière option active d'un chapitre** → son retrait désactive le chapitre entier ; l'aperçu doit le refléter, pas montrer un filtre « vide mais actif ».
- **Aperçu identique au compte courant** (l'option ne change rien) → affiché normalement, sans traitement particulier.
- **Liste des applications encore en chargement** → aucun aperçu plutôt qu'un zéro trompeur.
- **Survol rapide de plusieurs options à la suite** → pas d'accumulation de calculs ni de scintillement du libellé.
- **`FilterBar` utilisé par `/map`** avec une liste différente → soit l'aperçu y est absent, soit il est calculé sur la bonne liste ; jamais un compte issu du catalogue.

## Open Questions
- **Forme d'affichage** : nombre affiché à droite à l'intérieur du bouton (place réservée en permanence pour éviter le décalage), ou info-bulle flottante réutilisant le style de celles de la rangée ACTIONS ? => affiché à droite

- **Transmission de la donnée** : `FilterBar` reçoit-il la liste complète des applications pour calculer lui-même, ou une fonction fournie par le parent (`(valeurHypothétique) => nombre`) ? La seconde forme évite de faire dépendre `FilterBar` du modèle de données et règle proprement le cas `/map`. => suivre ta reecommendation

- **Mise en évidence du zéro** : faut-il distinguer visuellement une option menant à zéro résultat, ou se contenter du nombre ? => se contenter du nombre

## Acceptance Criteria
- [ ] Survoler une option inactive d'un chapitre affiche le nombre d'applications qui seraient visibles après activation, en tenant compte de tous les autres filtres actifs.
- [ ] Survoler une option active affiche le nombre qui résulterait de sa désactivation.
- [ ] Le nombre affiché correspond exactement au nombre obtenu après le clic (aperçu et résultat ne divergent jamais).
- [ ] L'aperçu apparaît aussi au focus clavier et disparaît à la sortie.
- [ ] Aucun décalage de mise en page ni scintillement lors du survol.
- [ ] Fonctionne à l'identique dans le panneau mobile.
- [ ] Aucun appel réseau, aucune latence perceptible sur la liste complète.
- [ ] Build Next OK, aucune régression sur le filtrage, le compteur global ou `/map`.
