# Feature Spec: « Show Consumers » en Vue Simple sans Passer par « Show API »

## Summary

- En **vue Simple**, le menu contextuel d'une application propose « Show Consumers » avec un compteur non nul — et le clic **ne fait rien**.
- Cause : l'action ne parcourt que les **interfaces déjà présentes** sur le canevas, et la seule commande qui les fait apparaître, « Show API », est volontairement masquée en vue Simple. L'utilisateur n'a donc aucun moyen d'en sortir.
- Correctif : en vue Simple, « Show Consumers » **révèle d'abord les interfaces** de l'application — exactement ce que ferait « Show API » — puis remonte leurs consommateurs.
- Rien de visible n'est ajouté au diagramme : en vue Simple les cercles d'interface ne sont pas dessinés. Ce sont les applications consommatrices et les flux repliés qui apparaissent, c'est-à-dire ce que la commande annonce.

## Motivation

- C'est un **clic mort**, le pire défaut d'une commande : le menu affiche « Show Consumers 0 / 4 », donc promet quatre applications, et ne livre rien. Rien à l'écran ne dit pourquoi.
- Le compteur, lui, est juste : il est calculé sur **toutes** les interfaces de l'application, révélées ou non. C'est l'action qui est en retard sur ce que le menu annonce.
- En vue Complex, l'utilisateur peut s'en sortir seul : il clique « Show API », les cercles apparaissent, puis « Show Consumers » fonctionne. En vue Simple, « Show API » est masqué — à juste titre, puisque son seul effet serait de révéler des cercles que cette vue ne dessine pas. L'utilisateur est donc dans une impasse.
- L'asymétrie est accidentelle, pas conçue : « Show providers », dans le même menu, **fait déjà** ce qu'on demande ici. Il interroge le modèle, ajoute les applications fournisseurs **et monte leurs interfaces** au passage, sans rien demander à personne — y compris en vue Simple. Deux commandes voisines du même menu ne devraient pas différer sur ce point.

## Décisions (arbitrées)

### Révéler les interfaces est un moyen, pas un effet de bord

- « Show Consumers » énonce un but : faire apparaître les applications qui consomment celle-ci. Les interfaces sont le **chemin** par lequel le modèle relie les deux — une relation `consommateur → interface → fournisseur`, jamais `application → application`.
- Monter ces interfaces pour atteindre les consommateurs n'est donc pas un débordement de la commande : c'est ce qu'elle a toujours fait, à ceci près qu'elle exigeait jusqu'ici que quelqu'un l'ait fait à sa place.
- Le précédent existe déjà dans le même menu : « Show providers » monte des interfaces sans jamais l'annoncer.

### Ce qui apparaît à l'écran, et ce qui n'apparaît pas

- En **vue Simple** : les applications consommatrices et les flux repliés `consommateur → fournisseur`. **Aucun cercle** — la vue ne les dessine pas.
- Les interfaces sont bien **montées** dans le modèle du canevas, simplement pas rendues. C'est déjà ainsi que fonctionne la vue Simple : elle filtre à l'affichage, elle ne supprime rien.
- **Conséquence à assumer** : basculer ensuite en vue Complex fera apparaître ces cercles, que l'utilisateur n'a pas demandés explicitement. C'est l'état réel du diagramme et non un artefact — les flux qu'il vient de faire apparaître passent par ces interfaces. Le masquer serait mentir sur ce que la vue Complex montre.

### Le compteur devient enfin honnête

- Après l'action, le nombre de consommateurs affichés doit rejoindre le total annoncé, et l'entrée de menu se désactiver comme elle le fait déjà quand tout est montré.
- C'est le test le plus simple du correctif : un menu qui annonce 4 et une action qui en livre 4.

### Rien d'autre ne change dans le menu

- « Show API » reste **masqué** en vue Simple : sa seule raison d'être est de révéler des cercles, et cette vue n'en dessine pas. Le correctif supprime le besoin de cette commande, il ne la réintroduit pas.
- « Show providers » et « Hide » sont inchangés.
- Le menu de la variante **Interface** est inchangé : elle n'existe qu'en vue Complex, où un cercle est forcément déjà présent.

## Requirements

### Functional Requirements

- En vue Simple, un clic sur **« Show Consumers »** dans le menu d'une application fait apparaître les applications qui la consomment, ainsi que les flux correspondants, sans aucune manipulation préalable.
- L'action couvre **toutes** les interfaces fournies par l'application, y compris celles qui n'avaient jamais été révélées.
- Une application consommatrice **déjà présente** sur le canevas n'est pas dupliquée ; seul le flux manquant est ajouté.
- Le compteur « affichés / total » de l'entrée reflète le résultat après l'action, et l'entrée se désactive lorsque tout est montré.
- Aucun cercle d'interface n'est dessiné en vue Simple à l'issue de l'action.
- En l'absence de consommateur, l'action ne fait rien de visible et n'affiche pas d'erreur — l'entrée était de toute façon déjà désactivée à 0 / 0.
- Le menu se ferme au clic, comme pour toutes les autres actions.
- Le travail en cours ne doit pas laisser l'écran figé sans explication : la commande peut demander plusieurs interrogations du modèle, et cela doit rester perceptible ou assez bref pour ne pas se remarquer.

### Non-Functional Requirements

- **Aucune interrogation inutile** : les interfaces d'une application et leurs fiches sont déjà mises en cache par le graphe une fois chargées. Une seconde exécution de la commande ne doit rien redemander.
- Les interfaces montées mais non dessinées ne doivent pas perturber l'élagage : masquer une application doit continuer à retirer ce qui n'est plus rattaché à rien, cercles invisibles compris.
- La géométrie des flux repliés est déjà dérivée des interfaces : le repli `consommateur → fournisseur` doit se produire sans traitement particulier.
- Aucune régression sur le glisser, le zoom, la mise en avant, les couleurs de data objects ni l'animation des flux.

## Scope

### In Scope

- Le comportement de « Show Consumers » sur une application, en vue Simple.
- La cohérence du compteur de cette entrée avec ce que l'action produit.

### Out of Scope

- Réafficher « Show API » en vue Simple.
- Modifier « Show providers », « Hide », ou le menu de la variante Interface.
- Changer la règle de calcul des compteurs.
- Introduire un réglage permettant de choisir si les interfaces sont montées ou non.
- Masquer, en vue Complex, les cercles montés pendant un passage en vue Simple.

## Affected Areas

- `components/discover/DiscoverGraph.tsx` — l'action « Show Consumers » d'une application, qui aujourd'hui ne parcourt que les interfaces déjà visibles ; et le chargement des interfaces d'une application, déjà écrit et déjà mis en cache pour « Show API » et « Show providers ».
- `components/discover/NodeContextMenu.tsx` — seulement si le libellé ou l'état désactivé de l'entrée doit changer ; l'intention est de n'y toucher qu'en dernier recours.

## Edge Cases

- **Application sans interface fournie** : rien à révéler, rien à faire ; l'entrée est déjà à 0 / 0 et désactivée.
- **Interfaces fournies mais aucun consommateur** : les interfaces sont montées, aucune application n'apparaît. En vue Simple, l'écran ne bouge pas — acceptable, puisque le compteur annonçait 0.
- **Consommateurs déjà tous affichés** : l'entrée est désactivée, aucun clic possible.
- **Consommateur déjà présent via un autre chemin** : pas de doublon, seul le flux est ajouté.
- **Consommateur absent du catalogue** : il apparaît comme n'importe quelle application révélée, sans camembert de capacités et sans données de catalogue — comportement déjà en place.
- **Bascule Simple → Complex après l'action** : les cercles montés apparaissent. C'est l'état réel du diagramme.
- **Bascule Complex → Simple puis clic** : certaines interfaces sont déjà là, d'autres non ; l'action doit traiter les deux cas sans dupliquer quoi que ce soit.
- **Masquer ensuite l'application d'origine** : l'élagage doit emporter les interfaces devenues orphelines, visibles ou non.
- **Clics répétés** : la seconde exécution ne doit rien ajouter et ne doit rien redemander au modèle.
- **Diagramme enregistré puis rechargé** : les interfaces montées font partie du diagramme sauvegardé, comme aujourd'hui pour « Show providers ».

## Open Questions

1. **La vue Complex mérite-t-elle le même traitement ?** Le clic y est tout aussi mort quand aucune interface n'est révélée : le menu annonce « 0 / 4 » et ne livre rien tant qu'on n'a pas pensé à « Show API ». Et contrairement à ce qu'on pourrait croire, y révéler les cercles n'est pas un ajout cosmétique : en vue Complex un flux va d'une application **vers un cercle**, donc sans le cercle le consommateur ne pourrait même pas être relié. **Recommandation : appliquer la même règle dans les deux vues** — une commande qui annonce un nombre doit le livrer, et la différence de rendu entre les deux vues suffit à expliquer ce qu'on voit. L'alternative est de ne corriger que la vue Simple, au prix de deux comportements différents pour une même entrée de menu. => suivre recommendation

## Acceptance Criteria

1. En vue Simple, sur une application dont le menu affiche « Show Consumers 0 / N » avec N > 0, un clic fait apparaître les N applications consommatrices et leurs flux.
2. Aucun cercle d'interface n'est visible sur le canevas après cette action, tant qu'on reste en vue Simple.
3. Rouvrir le menu après l'action montre « N / N » et une entrée désactivée.
4. Une application consommatrice déjà présente n'est pas dupliquée ; le flux manquant est bien tracé.
5. Basculer en vue Complex après l'action montre les cercles d'interface par lesquels passent ces flux.
6. Rejouer la commande ne modifie plus rien et ne déclenche aucune nouvelle interrogation du modèle.
7. « Show API » reste absent du menu en vue Simple.
8. « Show providers », « Hide » et le menu des cercles d'interface se comportent exactement comme avant.
9. Masquer l'application d'origine élague les interfaces devenues orphelines, y compris celles montées sans être dessinées.
10. `npx tsc --noEmit` et `npm run build` passent ; aucune erreur en console sur `/discover`.
