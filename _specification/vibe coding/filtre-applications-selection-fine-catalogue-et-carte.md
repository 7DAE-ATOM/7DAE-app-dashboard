# Feature Spec: Filtre « Applications » — Sélection Fine dans le Catalogue et la Carte

## Summary

- Un dernier chapitre **Applications** dans le panneau de filtres partagé par le Catalogue et la Carte, sous tous les autres.
- Il liste, avec une case à cocher par ligne, **les applications que les autres filtres laissent passer** — exactement celles rendues en cartes.
- Décocher une ligne retire l'application de l'affichage sans toucher aux autres filtres. C'est l'étape de réglage fin, après le dégrossissage.
- La liste suit les autres filtres : elle se recompose à chaque changement.
- Même forme que le filtre **Displayed LTM** de l'onglet DependencyView de `7DAE-ltm-dashboard` : recherche, « Select all » / « Deselect all », liste défilante à cases natives.

## Motivation

- Les filtres existants sont des axes : catégorie, statut, portefeuille, capacité, data object. Ils décrivent des **familles**, jamais des exceptions. Or une sélection utile se termine presque toujours par « celles-là, sauf ces deux-là ».
- Aujourd'hui, retirer deux applications d'un résultat de quinze suppose de trouver un axe qui les distingue — il n'en existe pas toujours — ou de renoncer.
- Ce que l'écran montre est aussi ce qui part ailleurs : l'export PDF et le bouton « Show in Discover » travaillent sur le résultat des filtres. Pouvoir écarter deux applications avant d'exporter ou d'ouvrir un diagramme est le vrai besoin derrière la demande.
- La forme est déjà éprouvée dans l'application voisine : liste à cases, recherche, tout sélectionner / tout désélectionner. Rien à inventer.

## Décisions (arbitrées)

### On mémorise ce qui est **écarté**, jamais ce qui est retenu

- Le chapitre garde la liste des applications **décochées**, et non celle des cochées. C'est la seule façon de rester cohérent quand les autres filtres bougent : une application qui entre dans le résultat arrive **cochée**, donc visible.
- L'inverse — mémoriser les cochées — rendrait invisible toute application nouvellement admise par les autres filtres, et l'écran se viderait à chaque élargissement d'un filtre. C'est le même choix que le `hiddenIds` de l'implémentation de référence.

### La liste montre le résultat **avant** exclusion

- Les lignes affichées sont celles que les autres filtres laissent passer, décochées comprises. Sans cela, décocher une ligne la ferait disparaître de la liste et il deviendrait impossible de la recocher.
- C'est la distinction structurante du lot : un ensemble sert à **remplir la liste**, l'autre à **alimenter l'écran**.

### Un chapitre partagé, comme tous les autres

- Le panneau est commun au Catalogue et à la Carte, et c'est déjà ce que garantit le magasin de filtres partagé. Les exclusions y entrent comme n'importe quelle autre valeur de filtre : écarter une application dans le Catalogue la retire aussi des bulles de la Carte.
- Elles suivent donc la même durée de vie que les autres filtres : mémorisées pour l'onglet, oubliées à sa fermeture, jamais partagées entre onglets.
- « Clear » les efface avec le reste.

### Les compteurs des autres chapitres tiennent compte des exclusions

- Le panneau annonce déjà, sur chaque option, combien d'applications elle laisserait passer. Ce compteur est calculé par le **même chemin** que le résultat affiché, précisément pour qu'un compteur et son résultat ne puissent jamais se contredire.
- Les exclusions doivent donc entrer dans ce chemin. Conséquence assumée : décocher une application fait baisser des compteurs ailleurs dans le panneau. C'est désagréable et c'est juste — l'alternative serait un compteur qui promet plus que ce que l'écran montre.

### Ce qui est écarté doit se voir, même chapitre replié

- Le chapitre porte un compteur d'applications **masquées**, comme les autres chapitres portent le nombre de valeurs cochées. Sans lui, un résultat amputé resterait inexpliqué.
- À l'intérieur, un rappel « N affichées sur M » au-dessus de la liste.
- Les exportations qui décrivent les filtres actifs (en-tête du PDF) mentionnent le nombre d'applications masquées : un document filtré doit dire comment.

### Une exclusion survit à un changement de filtre

- Une application décochée, puis sortie du résultat par un autre filtre, puis réadmise, revient **décochée**. Le geste exprimait « je ne veux pas la voir », pas « pas dans ce résultat-ci ».
- Le compteur du chapitre est ce qui empêche cette mémoire d'être silencieuse.

### Cases natives, pas les puces des autres chapitres

- Les autres axes affichent des puces cliquables : ils ont quelques valeurs. Celui-ci peut en avoir des centaines, et les puces deviennent illisibles à cette échelle.
- Une liste défilante à hauteur plafonnée, cases à cocher natives, une ligne par application — la forme de la référence.

## Requirements

### Functional Requirements

#### Le chapitre

- Intitulé **Applications**, placé **en dernier**, après Data Object.
- Repliable comme les autres, avec le même mécanisme de mémorisation d'ouverture.
- Porte le nombre d'applications masquées quand il y en a.
- Présent à l'identique dans le panneau du Catalogue, dans la feuille mobile et sur la Carte.

#### La liste

- Une ligne par application laissée passer par les autres filtres, triée comme le catalogue les présente.
- Chaque ligne : une case à cocher (cochée = visible) et le nom de l'application, tronqué avec infobulle.
- Décocher retire l'application des cartes du Catalogue et des bulles de la Carte, sans modifier aucun autre filtre.
- La liste se recompose à chaque changement des autres filtres.
- Un rappel « N affichées sur M » au-dessus de la liste.
- Un champ de recherche restreignant les lignes affichées.
- Deux actions, « Select all » et « Deselect all », désactivées quand elles n'auraient aucun effet.
- Zone défilante à hauteur plafonnée, de sorte que le chapitre n'écrase pas le reste du panneau.
- Aucune application dans le résultat : la liste affiche un message, et les deux actions sont inertes.

#### Effets attendus ailleurs

- L'export PDF du catalogue et le bouton « Show in Discover » portent sur ce qui reste **après** exclusions.
- La pagination du catalogue et le compteur de résultats suivent le même ensemble.
- Le badge de filtres actifs et le lien « Clear » prennent les exclusions en compte.

### Non-Functional Requirements

- Aucune requête supplémentaire : la liste est construite à partir des applications déjà chargées.
- Le rendu doit rester fluide sur un portefeuille de plusieurs centaines d'applications : la liste défile, elle ne bloque pas l'ouverture du panneau.
- Cocher ou décocher une ligne ne doit pas provoquer un recalcul complet des hiérarchies de capacités et de data objects.
- Valeurs validées à la relecture du stockage comme les autres axes : une liste d'identifiants inconnus ne doit rien casser — elle ne correspondra simplement à rien.
- Accessible au clavier, cases natives étiquetées ; couleurs par tokens, thème clair et sombre.

## Scope

### In Scope

- Le chapitre Applications, sa liste, sa recherche, ses deux actions groupées et son compteur.
- L'entrée des exclusions dans les filtres partagés, leur mémorisation et leur remise à zéro.
- La prise en compte des exclusions dans le résultat, les compteurs, la pagination et les exports.

### Out of Scope

- Une sélection **positive** (ne montrer que celles-ci) : c'est l'autre mémoire, écartée plus haut.
- Un réglage persistant au-delà de l'onglet, ou partagé entre onglets.
- Une liste virtualisée — voir la question ouverte sur le volume.
- Un chapitre équivalent sur la page Discover, qui a son propre panneau et sa propre logique.
- Modifier les axes existants ou leur mode de calcul.

## Affected Areas

- `components/FilterBar.tsx` — le nouveau chapitre, en dernière position ; c'est le composant que le Catalogue, la feuille mobile et la Carte partagent.
- `lib/appFilters.ts` — la valeur de filtre supplémentaire, sa validation à la relecture et sa remise à zéro.
- `lib/useFilteredApplications.ts` — doit désormais rendre **deux** ensembles : celui qui remplit la liste et celui qui alimente l'écran.
- `lib/applications.ts` — l'application des exclusions, en dernier.
- `lib/filterDescription.ts` — la mention des applications masquées dans l'en-tête du PDF.
- `components/CatalogueClient.tsx`, `components/MapClient.tsx` — consommateurs du résultat ; rien à décider chez eux, mais ils doivent recevoir le bon ensemble.
- Référence de forme : `components/radar/BenchVisibilityList.tsx` dans `7DAE-ltm-dashboard`.

## Edge Cases

- **Toutes les applications décochées** : le Catalogue et la Carte sont vides ; le compteur du chapitre et le rappel « 0 affichées sur M » expliquent pourquoi.
- **Un autre filtre vide le résultat** : la liste est vide et le dit ; les exclusions mémorisées restent.
- **Application décochée puis réadmise par un autre filtre** : elle revient décochée.
- **Application décochée puis disparue du référentiel** : son identifiant ne correspond plus à rien, sans erreur.
- **Recherche active dans la liste** : elle ne change pas ce qui est affiché à l'écran, seulement les lignes proposées (voir question ouverte sur la portée des deux actions).
- **Liste très longue** : hauteur plafonnée, défilement ; les autres chapitres restent atteignables.
- **Feuille mobile** : le chapitre s'y comporte comme les autres, sans que la liste ne mange tout l'écran.
- **Page du catalogue au-delà du dernier résultat** après des exclusions : même traitement que pour tout autre filtre qui réduit le résultat.
- **Exclusions actives au moment d'un « Show in Discover »** : le diagramme s'ouvre sur ce qui reste, et le seuil d'avertissement se calcule sur ce nombre-là.

## Open Questions

1. **« Select all » / « Deselect all » pendant une recherche** doivent-ils agir sur **toute** la liste ou sur les seules lignes affichées ? La référence agit sur toute la liste, et le documente. **Recommandation : agir sur les lignes affichées** — après avoir tapé trois lettres, « Deselect all » sur l'ensemble est une surprise destructive, et l'action sur le sous-ensemble est le geste qu'on vient précisément de préparer. => suivre recommendation

2. **Au-delà de quel volume la liste cesse-t-elle d'être utilisable ?** La référence plafonne son affichage en amont ; ici rien ne le fait. **Recommandation : ne rien plafonner pour l'instant**, mesurer sur le portefeuille réel, et n'ajouter un message invitant à resserrer les autres filtres que si la gêne se confirme. => suivre recommendation


3. **Le nom suffit-il sur chaque ligne**, ou faut-il l'External ID en second ? Deux applications peuvent porter des noms proches. **Recommandation : le nom seul**, avec l'External ID en infobulle — la ligne doit rester lisible. => suivre recommendation


4. **Faut-il purger les exclusions** devenues sans objet (identifiants absents du référentiel) au chargement ? **Recommandation : non** — elles ne correspondent à rien et ne coûtent rien ; les purger masquerait un écart de données au lieu de le laisser visible. => suivre recommendation


## Acceptance Criteria

1. Le panneau de filtres affiche un dernier chapitre **Applications**, présent dans le Catalogue, dans la feuille mobile et sur la Carte.
2. Déplié, il liste exactement les applications que les autres filtres laissent passer, toutes cochées au départ.
3. Décocher une ligne retire l'application des cartes du Catalogue et des bulles de la Carte, sans modifier les autres filtres.
4. La ligne décochée **reste** dans la liste, décochée, et peut être recochée.
5. Changer un autre filtre recompose la liste ; les applications nouvellement admises arrivent cochées.
6. Une application décochée, écartée par un autre filtre, puis réadmise, revient décochée.
7. Le chapitre affiche le nombre d'applications masquées, visible même replié, et un rappel « N affichées sur M ».
8. La recherche interne restreint les lignes proposées sans rien changer à l'affichage.
9. « Select all » et « Deselect all » sont désactivés quand ils n'auraient aucun effet.
10. « Clear » remet toutes les applications visibles en même temps que les autres filtres.
11. L'export PDF et « Show in Discover » ne portent que sur les applications restantes, et l'en-tête du PDF mentionne le nombre de masquées.
12. Le compteur de résultats, la pagination et les compteurs des autres chapitres s'accordent avec ce qui est affiché.
13. Les exclusions survivent à un rechargement de l'onglet et disparaissent à sa fermeture.
14. `npx tsc --noEmit` et `npm run build` passent ; aucune erreur ni avertissement d'hydratation en console.
