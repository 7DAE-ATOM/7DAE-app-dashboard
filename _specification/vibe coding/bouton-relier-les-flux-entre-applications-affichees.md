# Feature Spec: Bouton « Relier les Flux » entre Applications Affichées

## Summary

- Un bouton d'action dans la barre d'outils de `/discover`, **à droite du bascule Simple/Complex**, qui fait apparaître **tous les flux manquants entre les applications déjà affichées**.
- Exemple type : A et B sont sur le diagramme, A consomme une interface exposée par B, et rien ne les relie à l'écran parce que cette interface n'a jamais été révélée. Un clic, et le lien apparaît.
- L'action **ne fait grandir le diagramme d'aucune application** : elle referme ce qui existe déjà entre les éléments présents, elle n'explore pas plus loin.
- C'est une **action ponctuelle**, pas un mode : rien à activer, rien à mémoriser ; le bouton travaille puis rend la main en disant ce qu'il a trouvé.

## Motivation

- Le diagramme se construit par ajouts successifs — depuis le catalogue, depuis la recherche, par dépliage de voisinage. Chaque application arrive avec ses propres liens, et **rien ne garantit que les liens entre deux applications arrivées séparément soient tracés**. Deux applications qui s'échangent des données peuvent donc se retrouver côte à côte, sans aucun trait entre elles.
- Le diagramme ment alors par omission, et c'est le pire cas : un schéma d'architecture dont on croit qu'il est complet. Personne ne se demande spontanément « est-ce qu'il manque un lien ? ».
- Le seul recours aujourd'hui est d'ouvrir le menu contextuel de **chaque** application et d'y cliquer « Show Consumers » puis « Show providers » — sur vingt rectangles, quarante gestes, et l'exploration ramène au passage des applications qu'on n'avait pas demandées.
- Ce bouton fait exactement le travail utile, et rien d'autre : **fermer le graphe sur lui-même**.

## Décisions (arbitrées)

### Entre ce qui est affiché, et rien de plus

- L'action ajoute des **interfaces** et des **flux**. Elle n'ajoute **aucune application**.
- C'est ce qui la rend prévisible et rejouable : le résultat est borné par ce qui est déjà à l'écran, et le diagramme ne peut pas exploser sous un clic. Une action d'exploration existe déjà pour l'autre besoin — le menu contextuel, application par application, avec ses compteurs qui annoncent ce qu'un clic va ramener.
- Conséquence lisible : après l'action, **plus aucun lien ne manque** entre les applications présentes. C'est une propriété qu'on peut énoncer, vérifier, et sur laquelle on peut s'appuyer avant de présenter un schéma.

### Balayer les interfaces consommées suffit

- Un flux relie toujours **un** consommateur à **une** interface, elle-même exposée par **un** fournisseur. Il a donc exactement un consommateur.
- Parcourir, pour chaque application affichée, les interfaces qu'elle **consomme**, et retenir celles dont le fournisseur est lui aussi affiché, suffit donc à trouver **tous** les liens manquants — sans les chercher deux fois, une fois de chaque côté.
- Le cercle d'interface est monté chez son **fournisseur**, comme partout ailleurs dans Discover.

### Une action, pas un mode

- Le bouton n'a pas d'état actif/inactif et ne mémorise rien : il n'y a rien à persister. Ses voisins immédiats sont des bascules ; lui ne l'est pas, et cela doit se voir — il ne doit jamais rester « allumé ».
- Pendant qu'il travaille, il l'indique et n'est pas re-déclenchable. L'action peut interroger le modèle une fois par application affichée, ce qui n'est pas instantané sur un grand diagramme.
- Rejouer l'action est sans effet et sans coût : rien n'est ajouté deux fois, et ce qui a déjà été chargé n'est pas redemandé.

### Dire ce qui a été fait

- Une action qui ne montre rien de neuf est indiscernable d'une action qui n'a pas marché. À la fin, un message bref annonce **ce qui a été ajouté** — ou qu'il n'y avait rien à ajouter, ce qui est une bonne nouvelle et doit se lire comme telle.
- Le message emprunte le bandeau déjà utilisé par les autres notices de la page. Ce sera la **cinquième** copie de ce bloc : le moment est venu d'en faire un petit composant de notice, et ce lot est l'occasion raisonnable de le faire.

### Le volume est un vrai sujet

- Le coût est d'une interrogation par application affichée. Sur un diagramme de quelques dizaines, c'est confortable ; sur plusieurs centaines — ce que « Show in Discover » sait produire — c'est une attente longue et un graphe qui peut devenir illisible d'un coup.
- Au-delà d'un **seuil**, l'action demande donc confirmation, en annonçant le nombre d'applications à analyser. La modale d'avertissement de « Show in Discover » est le précédent exact : même composant, même forme, message adapté.
- Le seuil ne **bloque** pas : il avertit. L'utilisateur qui sait ce qu'il fait continue.

### Les deux vues, sans traitement particulier

- En vue **Complex** : les cercles d'interface apparaissent, et les flux `consommateur → interface`.
- En vue **Simple** : les cercles sont montés sans être dessinés, et les flux repliés `consommateur → fournisseur` apparaissent. Même mécanique que les commandes du menu contextuel — la vue filtre à l'affichage, elle ne supprime rien.

## Requirements

### Functional Requirements

#### Le bouton

- Dans le bloc droit de la barre d'outils de `/discover`, **immédiatement à droite du bascule Simple/Complex** — donc avant l'icône d'animation des flux, qui se décale d'un cran.
- Même gabarit et même cadre que ses voisins, mais **sans état enfoncé** : c'est une action.
- Un pictogramme au trait évoquant des éléments que l'on relie.
- Infobulle nommant l'action et précisant qu'elle n'ajoute **aucune application**.
- **Désactivé** quand le canevas contient moins de deux applications : il n'y a rien à relier.
- Pendant le travail : état d'avancement visible, bouton non re-déclenchable.

#### L'action

- Pour chaque application affichée, retrouver les interfaces qu'elle consomme, et retenir celles dont l'application fournisseur est **elle aussi affichée**.
- Monter les interfaces retenues qui manquent, chez leur fournisseur, et tracer les flux correspondants.
- Ne pas ajouter d'application, ne pas en retirer, ne pas déplacer celles qui sont là.
- Ne rien dupliquer : une interface déjà montée ou un flux déjà tracé est laissé tel quel.
- À la fin, annoncer le résultat : nombre de flux ajoutés, ou absence de flux manquant.
- Au-delà du seuil d'applications affichées, demander confirmation avant de commencer, en annonçant le nombre concerné ; l'annulation ne produit aucun effet.
- Le diagramme est marqué comme modifié dès qu'un flux a été ajouté, comme pour toute autre modification du canevas.

#### Ce qui ne change pas

- Le menu contextuel et ses commandes, leurs compteurs, leurs règles de désactivation.
- La mise en avant, les couleurs de data objects, les camemberts de capacités, l'animation des flux : tout s'applique aux nouveaux éléments sans traitement particulier.
- La disposition : aucune remise en page automatique, aucun recadrage.

### Non-Functional Requirements

- **Rien de redemandé** : les interfaces d'une application et leurs fiches sont déjà mises en cache par le graphe. Une seconde exécution ne doit produire aucune interrogation.
- Les interrogations du modèle ne doivent pas figer la page : l'utilisateur doit pouvoir continuer à regarder le diagramme pendant le travail.
- Le canevas ne doit pas être reconstruit application par application au point de clignoter : l'ajout doit se lire comme un événement, pas comme une cascade.
- Une interrogation en échec ne doit pas interrompre le reste : le travail se poursuit sur les autres applications, et le message final reste honnête sur ce qui a été fait.
- Aucune régression sur le glisser, le zoom, l'élagage, l'enregistrement et le rechargement d'un diagramme.

## Scope

### In Scope

- Le bouton, sa place, son pictogramme, son infobulle, son état désactivé et son état de travail.
- La recherche et l'ajout des interfaces et des flux manquants entre applications affichées.
- Le message de résultat, et l'extraction du bandeau de notice devenu quintuple.
- La confirmation au-delà du seuil, sur le modèle de celle de « Show in Discover ».

### Out of Scope

- **Ajouter des applications** non affichées — voir la question ouverte ci-dessous.
- Retirer des flux, ou proposer l'action inverse (« ne garder que… »).
- Réorganiser le diagramme après l'ajout.
- Une exécution automatique à l'ouverture d'un diagramme ou après chaque ajout d'application.
- Modifier le menu contextuel ou ses compteurs.
- Un réglage persistant lié à cette action.

## Affected Areas

- `components/DiscoverClient.tsx` — la barre d'outils, l'état de travail, la confirmation au-delà du seuil et le message de résultat.
- `components/discover/DiscoverGraph.tsx` — l'action elle-même : c'est le seul endroit qui connaît le contenu du canevas, le chargement des interfaces d'une application, leur mise en cache et le placement des cercles chez leur fournisseur. Tout ce dont l'action a besoin y existe déjà pour les commandes du menu contextuel.
- Un nouveau composant d'icône dans `components/icons/`.
- Un petit composant de bandeau de notice, extrait des quatre copies existantes de `DiscoverClient`.
- Le composant de modale d'avertissement déjà utilisé par « Show in Discover », réemployé tel quel.

## Edge Cases

- **Moins de deux applications affichées** : bouton désactivé.
- **Aucun flux manquant** : rien ne change, et le message le dit clairement.
- **Application qui consomme sa propre interface** : traitée comme partout ailleurs dans Discover — un cercle sur elle-même en vue Complex, rien en vue Simple.
- **Deux applications reliées par plusieurs interfaces** : toutes apparaissent en vue Complex ; en vue Simple elles se replient en un seul flux.
- **Interface déjà montée, flux non tracé** : seul le flux est ajouté.
- **Application hors catalogue** ramenée par un dépliage : elle est analysée comme les autres — c'est le modèle qui est interrogé, pas le catalogue.
- **Interrogation en échec sur une application** : les autres sont traitées, et le message final n'annonce pas un travail complet.
- **Clic pendant qu'un autre chargement est en cours** : le bouton est indisponible, comme pendant son propre travail.
- **Diagramme très dense après l'action** : aucun recadrage, aucune remise en page — c'est le choix de Discover partout ailleurs, et le contraire ferait perdre la disposition construite à la main.
- **Enregistrement puis rechargement** : les interfaces et flux ajoutés font partie du diagramme, comme ceux ramenés par le menu contextuel.
- **Rejeu immédiat** : rien n'est ajouté, aucune interrogation n'est émise, et le message dit qu'il n'y avait rien à ajouter.

## Open Questions

1. **L'action doit-elle aussi faire apparaître l'application fournisseur quand elle n'est pas affichée ?** La phrase « toutes les relations **entre les éléments affichés** » dit non, l'exemple (« une interface exposée par application B pas encore montré ») peut se lire dans les deux sens. **Recommandation : non** — une action qui ajoute des applications n'est plus bornée par ce qui est à l'écran, son résultat devient imprévisible avant le clic, et c'est déjà ce que fait le menu contextuel, application par application, avec des compteurs qui annoncent ce qui va arriver. Si le besoin est bien d'étendre, c'est une **seconde** commande, à distinguer clairement de celle-ci. => oui on affiche les liens uniquement sur les applications déjà présentes à l'écran

2. **Le seuil de confirmation** : quelle valeur ? Proposition : le même ordre de grandeur que celui de « Show in Discover » (25), puisque c'est le même type d'attente. => seuil à 50

3. **L'infobulle suffit-elle à dire que rien ne sera ajouté comme application ?** Une commande qui promet « toutes les relations » peut laisser croire qu'elle va chercher au loin. Proposition : infobulle explicite, et message final qui nomme le périmètre. => oui

## Acceptance Criteria

1. Un bouton apparaît dans la barre d'outils, immédiatement à droite du bascule Simple/Complex, sans état enfoncé.
2. Avec moins de deux applications sur le canevas, il est désactivé.
3. Deux applications posées séparément, l'une consommant une interface de l'autre, sans lien à l'écran : un clic fait apparaître le lien.
4. Après l'action, plus aucun flux ne manque entre les applications affichées.
5. **Aucune application** n'a été ajoutée ni retirée du diagramme ; aucune n'a bougé.
6. En vue Simple, les flux repliés apparaissent sans qu'aucun cercle ne soit dessiné ; en vue Complex, les cercles et les flux vers eux apparaissent.
7. Un second clic ne change rien, n'émet aucune interrogation, et le message annonce qu'il n'y avait rien à ajouter.
8. Le bouton signale son travail et n'est pas re-déclenchable pendant.
9. Au-delà du seuil, une modale annonce le nombre d'applications à analyser ; « Cancel » n'a aucun effet.
10. Le message de résultat utilise le même bandeau que les autres notices de la page, désormais issu d'un composant unique.
11. Le diagramme est marqué comme modifié après un ajout, et l'enregistrement puis le rechargement restituent les flux ajoutés.
12. Les couleurs de data objects, les camemberts, la mise en avant et l'animation s'appliquent aux éléments nouvellement apparus.
13. `npx tsc --noEmit` et `npm run build` passent ; aucune erreur en console sur `/discover`.
