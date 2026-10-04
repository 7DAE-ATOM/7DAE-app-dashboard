# Feature Spec: Placement Unifié Radial des Applications Discover

## Summary
- Remplacer les **deux stratégies de placement** actuelles du graphe Discover — la mise en page ELK du démarrage « Show in Discover » et le placement local des commandes du diagramme — par **une seule stratégie**, utilisée dans tous les cas.
- Principe : placer *n* applications sur un canevas où d'autres sont déjà posées. Placer une application n'en est que le cas particulier *n* = 1 ; le démarrage, le cas particulier « canevas vide ».
- La disposition est **radiale** : les voisins d'une application se répartissent **tout autour d'elle**, en anneau, et non plus d'un seul côté.
- Une application qui a déjà des voisins placés reçoit ses nouveaux voisins en **éventail tourné vers l'extérieur**, pour que le graphe s'étende au lieu de se replier sur lui-même.
- Les **cercles d'interface** sont orientés à leur apparition vers leurs consommateurs, pour que les liens ne traversent pas la boîte de leur fournisseur.
- Ce qui est déjà sur le canevas **n'est jamais déplacé**, et le résultat est **sans chevauchement** et **reproductible**.

## Motivation
- Révéler les dépendances d'une application aujourd'hui envoie **tous** ses consommateurs à droite, en escalier descendant, alors que tout l'espace de gauche, du dessus et du dessous reste vide (constaté sur ATOM et ses six consommateurs).
- Trois causes se cumulent :
  - le côté est **figé par le rôle** : les consommateurs vont toujours à droite et les fournisseurs à gauche ;
  - chaque nouvelle application se place **à côté de la précédente** et non autour de l'application d'origine, ce qui forme une chaîne ;
  - les chevauchements ne se résolvent **que vers le bas**.
- La convention « fournisseurs à gauche, consommateurs à droite » ne tient pas en pratique : une application est souvent les deux à la fois, et le côté « logique » vu d'une application contredit celui vu de la suivante. Le sens d'un flux se lit déjà par la flèche.
- Discover sert à **explorer** à partir d'une application centrale. Une disposition radiale correspond à cet usage : liens courts et de longueurs comparables, voisinage lisible d'un coup d'œil, encombrement réduit.
- Avoir deux moteurs pour un même problème produit deux dessins différents pour un même graphe selon qu'il a été ouvert depuis le catalogue ou construit à la main. Une seule stratégie donne un rendu cohérent, se teste en un seul endroit et retire une dépendance.

## Décisions (arbitrées)
- **Radial pur.** La position ne porte plus le rôle fournisseur / consommateur. Aucune moitié d'anneau n'est réservée à un rôle.
- **Éventail vers l'extérieur** pour une application qui a déjà au moins un voisin placé ; **anneau complet** pour une application qui n'en a aucun.
- **Orientation des cercles d'interface** vers leurs consommateurs à leur apparition.
- **Une seule stratégie pour tous les cas** : le démarrage « Show in Discover », *Show dependencies*, *Show API* et l'ajout d'une application.
- **Un algorithme propre au projet, sans ELK.** L'alternative « ELK stress avec nœuds figés » est écartée, pour trois raisons :
  - elle ne garantit pas l'absence de chevauchement avec des boîtes larges et basses ;
  - la correction des chevauchements déplacerait aussi les nœuds figés ;
  - en exploration, les nouvelles applications seraient attirées par l'ensemble du graphe plutôt que par l'application explorée.
- **Le placement devient synchrone** : le démarrage n'attend plus une mise en page asynchrone.
- **Le choix de l'utilisateur prime.** Une boîte ou un cercle déplacé à la main n'est jamais repositionné par cette stratégie.

## Requirements

### Functional Requirements

#### Une stratégie, trois situations
- La stratégie reçoit trois choses :
  - les applications **déjà posées**, qui sont fixes ;
  - les applications **à placer** ;
  - les **liens** entre toutes ces applications.

  Elle renvoie une position pour chaque application à placer.
- **Démarrage « Show in Discover »** : aucune application fixe ; toute la sélection est à placer.
- **Commandes du diagramme** (*Show dependencies*, *Show API*) : le canevas est fixe ; les applications révélées sont à placer.
- **Ajout d'une application** depuis la recherche : le canevas est fixe ; une seule application sans lien est à placer.

#### Ordre de placement
- On part de ce qui est déjà placé et on progresse vers l'extérieur, par vagues.
- À chaque vague, une application déjà placée reçoit **en un seul groupe** tous ses voisins encore à placer. Ces voisins deviennent à leur tour points de départ pour la vague suivante.
- Une application liée à **plusieurs** applications déjà placées est posée près du **barycentre** de ces voisins, sur l'emplacement libre le plus proche, plutôt que dans l'anneau de l'un d'eux. Sans cette règle, une sélection fortement maillée produirait de longs liens traversant le graphe.
- Une application qui n'est liée à **rien de déjà placé** démarre un nouveau groupe :
  - on retient l'application la plus connectée de ce groupe ;
  - elle est posée dans un espace libre : au centre si le canevas est vide, sinon à côté de l'existant, sans le recouvrir ;
  - le placement reprend par vagues à partir d'elle.
- Les départages se font dans un **ordre stable** (nombre de liens, puis identifiant) : la même entrée produit toujours le même dessin.

#### Géométrie de l'anneau
- Les boîtes d'application sont nettement plus larges que hautes. L'anneau est donc une **ellipse**, plus large que haute, pour que l'espacement entre boîtes reste homogène tout autour.
- Le rayon du premier anneau laisse un espace confortable entre l'application centrale et ses voisins. Il tient compte de la largeur courante des boîtes (réglage *Box width*).
- Les voisins sont **régulièrement espacés** sur l'anneau.
- Au-delà de la capacité d'un anneau, les voisins restants passent sur un **anneau suivant**, plus large. Il n'y a pas de limite au nombre d'anneaux.
- Si une partie de l'anneau est déjà occupée par une boîte existante, la répartition **pivote** pour éviter les chevauchements. Ce qui ne trouve toujours pas de place passe à l'anneau suivant.

#### Éventail vers l'extérieur
- Une application qui a déjà au moins un voisin placé ne reçoit plus un anneau complet, mais un **éventail d'environ 240°**, centré sur la direction opposée à ses voisins déjà placés.
- L'éventail obéit aux mêmes règles d'espacement, d'anneaux successifs et d'évitement que l'anneau complet.

#### Limiter les croisements
- Les voisins sont regroupés par interface puis attribués aux emplacements **dans l'ordre angulaire**, pour que les liens d'une même interface partent dans un même secteur au lieu de s'entrecroiser.

#### Orientation des cercles d'interface
- À son apparition, un cercle d'interface est posé sur le **bord de la boîte de son fournisseur qui fait face à ses consommateurs**. S'il a plusieurs consommateurs, on utilise leur direction moyenne.
- Un cercle sans consommateur visible garde sa place par défaut, sur le bord supérieur.
- Plusieurs cercles orientés vers le même bord ne se superposent pas : ils sont espacés le long de ce bord.
- Un cercle que l'utilisateur a déplacé à la main **n'est jamais réorienté**.
- L'orientation s'applique dans toutes les situations, y compris au démarrage.

#### Ce qui ne change pas
- Les applications déjà sur le canevas, déplacées à la main ou non, ne bougent jamais.
- Le chargement d'un diagramme sauvegardé reprend les positions enregistrées, sans aucun calcul de placement.
- Les deux modes de vue (simplifiée et interfaces) partagent les mêmes positions d'application.

### Non-Functional Requirements
- **Aucun chevauchement** entre boîtes d'application produites par la stratégie, ni avec les boîtes existantes, avec une marge minimale entre elles.
- **Déterminisme** : à entrée identique, sortie identique.
- **Performance** : le placement d'une sélection de l'ordre de la centaine d'applications ne doit pas produire de gel perceptible de l'interface.
- **Testabilité** : la stratégie est une logique pure, vérifiable sans navigateur. Ses garanties (absence de chevauchement, nœuds fixes intacts, déterminisme) doivent pouvoir être vérifiées isolément.
- **Aucune nouvelle dépendance**. La dépendance de mise en page existante (ELK) devient inutile et doit être retirée.
- Respect de la règle « aucun appel à un tiers » : le retrait d'ELK ne doit laisser aucune référence orpheline dans le contrôle des URL externes.

## Scope

### In Scope
- La stratégie de placement unique et ses règles (vagues, barycentre, nouveaux groupes, anneau elliptique, anneaux successifs, éventail, évitement, ordre angulaire).
- Son utilisation par le démarrage « Show in Discover », *Show dependencies* (depuis une application ou une interface), *Show API* et l'ajout d'une application.
- Le regroupement des révélations d'une même commande en **un seul placement**, au lieu d'un placement par interface.
- L'orientation des cercles d'interface vers leurs consommateurs.
- Le retrait de la mise en page ELK, de la dépendance correspondante et de sa mention dans le contrôle des URL externes.
- La mise à jour de la spec `onglet-discover-graphe-dependances-applications.md`, qui cite ELK comme moteur de mise en page.

### Out of Scope
- Toute **réorganisation globale** à la demande (bouton « réarranger ») qui déplacerait des boîtes existantes.
- Le placement des applications d'un **diagramme chargé**, dont les positions viennent de la sauvegarde.
- L'animation des boîtes vers leur position.
- Le routage des liens et leur courbure, qui restent régis par le réglage global et la poignée par arête.
- La densité des cercles sur un même bord au-delà de l'espacement simple (pas de regroupement ni de repli).

## Affected Areas
- `lib/discover-graph-layout.ts` : la nouvelle stratégie y prend place, en remplacement de la mise en page ELK et du placement local actuel.
- `components/discover/DiscoverGraph.tsx` : le démarrage, *Show dependencies*, *Show API*, l'ajout d'une application et la pose des cercles d'interface s'appuient sur la stratégie unique. La révélation des dépendances distingue la récupération des données de leur placement, pour placer tout un groupe en une fois.
- `package.json` : retrait d'`elkjs`.
- `scripts/check-external-urls.mjs` : retrait de l'entrée propre à ELK.
- `_specification/vibe coding/onglet-discover-graphe-dependances-applications.md` : mise en cohérence de la mention du moteur de mise en page.

## Edge Cases
- **Sélection d'une seule application** au démarrage : posée au centre, sans voisin.
- **Sélection sans aucun lien interne** : chaque application forme son propre groupe ; les groupes sont posés côte à côte sans se recouvrir et restent compacts.
- **Plusieurs groupes disjoints** dans une même sélection : chacun est disposé radialement autour de son application la plus connectée, et les groupes ne se recouvrent pas.
- **Graphe fortement maillé** (beaucoup de liens entre les applications sélectionnées) : la règle du barycentre évite les liens traversants. Les liens restants peuvent se croiser, ce qui est accepté.
- **Application très connectée** (plusieurs dizaines de voisins) : plusieurs anneaux successifs, sans chevauchement.
- **Voisin déjà présent** sur le canevas : il n'est pas déplacé, seul le lien apparaît.
- **Application centrale dans un coin encombré** : l'anneau pivote, puis déborde sur l'anneau suivant ; aucune boîte existante n'est recouverte.
- **Commande rejouée** : rien de nouveau à placer, rien ne bouge.
- **Boîtes élargies à la main** : l'espacement tient compte de la largeur réelle de chaque boîte existante, pas seulement de la largeur par défaut.
- **Interface sans consommateur visible** : son cercle reste à sa position par défaut.
- **Cercle déplacé à la main**, puis nouveaux consommateurs révélés : le cercle reste où l'utilisateur l'a mis.
- **Échec du chargement des relations au démarrage** : les applications sont tout de même posées, chacune comme un groupe isolé, sans chevauchement.

## Open Questions
- **Rayon du premier anneau et marge entre boîtes** : valeurs à ajuster sur une vraie sélection. Proposition de départ : un rayon horizontal d'environ une largeur et demie de boîte, un rayon vertical d'environ deux à trois hauteurs de boîte. => suivre recommenation

- **Ouverture exacte de l'éventail** : 240° est la cible. À confirmer à l'usage, notamment pour les applications très connectées où un éventail plus large limiterait le nombre d'anneaux. => oui à confirmer à l'usage

- **Disposition des groupes disjoints** au démarrage : en ligne, en grille ou en spirale autour du premier groupe. Proposition : en grille compacte, du plus gros groupe au plus petit. => suivre recommendation

## Acceptance Criteria
- [ ] Révéler les dépendances d'ATOM répartit ses six consommateurs **tout autour** de lui, sans escalier ni regroupement d'un seul côté.
- [ ] Révéler les dépendances d'une application qui a déjà un voisin placé dispose les nouveaux voisins en éventail, du côté opposé à ce voisin.
- [ ] *Show API* utilise la même disposition radiale que *Show dependencies*.
- [ ] Ajouter une application depuis la recherche la pose dans un espace libre, sans recouvrir l'existant.
- [ ] Le démarrage « Show in Discover » dispose la sélection selon les mêmes règles : application la plus connectée au centre, voisins en anneau, puis éventails vers l'extérieur, groupes disjoints côte à côte.
- [ ] Un même graphe construit à la main ou ouvert depuis le catalogue présente la même logique de disposition.
- [ ] Aucune boîte produite ne chevauche une autre boîte, dans aucune situation.
- [ ] Aucune boîte déjà présente sur le canevas ne bouge lors d'une révélation ou d'un ajout.
- [ ] Rejouer la même commande sur le même état produit exactement le même dessin.
- [ ] Les cercles d'interface apparaissent sur le bord de leur fournisseur tourné vers leurs consommateurs, et un cercle déplacé à la main n'est jamais repositionné.
- [ ] Le chargement d'un diagramme sauvegardé restitue les positions enregistrées à l'identique.
- [ ] ELK n'est plus utilisé ni déclaré en dépendance, et le contrôle des URL externes passe toujours.
