# Feature Spec: Fiche d'Interface — Titre et Liste Dépliable des Data Objects

## Summary

- La fiche ouverte depuis l'icône d'information d'un cercle d'interface porte aujourd'hui comme titre le **nom du premier data object**. Elle portera désormais le **nom de l'interface**.
- Son corps déroule aujourd'hui **toutes les descriptions**, empilées : dès trois ou quatre data objects, il faut faire défiler pour savoir combien il y en a.
- Il devient une **liste** : une ligne par data object, repliée par défaut, avec un chevron qui déplie sa description et la replie.
- Le nombre de data objects se lit ainsi d'un coup d'œil, et la description ne s'affiche que lorsqu'on la demande.

## Motivation

- Une fiche doit dire **de quoi elle parle**. Titrée avec le nom d'un data object, elle se fait passer pour la fiche de ce data object — et quand plusieurs fiches sont épinglées en même temps, rien ne permet de retrouver laquelle appartient à quelle interface.
- Le choix initial avait sa logique : la description était ce que la fiche existait pour montrer, et répéter le nom de l'interface au-dessus aurait repoussé le texte utile vers le bas. La liste dépliable fait disparaître cette raison — plus rien ne pousse le texte, puisque le texte n'est plus affiché d'emblée.
- La question la plus fréquente devant une interface est **« combien, et lesquels ? »**, pas « que dit la description du troisième ? ». La présentation actuelle répond à la seconde et cache la première derrière une barre de défilement.

## Décisions (arbitrées)

### Le titre nomme l'interface

- Le nom de l'interface, et lui seul. Sans nom connu, le protocole, puis un libellé générique — dans cet ordre, du plus informatif au moins.
- Le nom du premier data object n'est pas perdu : il rejoint la liste, au même rang que les autres. C'est d'ailleurs plus juste, puisqu'il n'avait aucune raison d'être le seul sans ligne à lui.

### Une liste repliée, pas un empilement de textes

- Une ligne par data object : un chevron, le nom. Toutes repliées à l'ouverture.
- Le clic sur la ligne ou sur le chevron déplie la description sous le nom ; un second clic la replie. Le chevron pivote, comme partout ailleurs dans l'application (filtres du catalogue, sections repliables).
- **Plusieurs lignes peuvent être ouvertes en même temps.** Refermer automatiquement la précédente ferait perdre une comparaison que l'utilisateur est justement en train de faire, et rien ici ne justifie cette contrainte.
- L'état déplié est **volatil** et local à la fiche : il repart à zéro quand la fiche se ferme ou qu'elle s'ouvre sur une autre interface. Ce n'est pas une préférence, c'est une position de lecture.

### Le nombre doit se lire sans compter

- La liste est précédée d'un intitulé portant le **nombre** de data objects. C'est la réponse directe au défaut signalé : même si la liste dépasse la hauteur visible, le chiffre, lui, est là.
- Le corps reste défilant et redimensionnable, comme aujourd'hui — mais avec des lignes repliées, la hauteur par défaut en montre plusieurs fois plus.

### Un data object sans description

- Pas de chevron : un contrôle qui s'ouvre sur un tiret est du bruit.
- Son nom reste aligné sur celui des autres, grâce à un espace réservé de la même largeur que le chevron — exactement le procédé déjà employé par l'arbre des filtres hiérarchiques pour ses feuilles.

### Ce qui ne bouge pas

- L'ouverture depuis l'icône d'information du cercle, l'épinglage de plusieurs fiches, le déplacement par l'en-tête, le redimensionnement du corps, la fermeture par la croix.
- La ligne **Protocole** en pied de fiche.
- L'ordre des data objects : celui que l'adaptateur produit déjà (dédoublonné, trié par nom).
- Les descriptions restent rendues **comme du texte**, jamais comme du balisage : celles de LeanIX portent parfois une mise en forme qui leur est propre.

## Requirements

### Functional Requirements

#### L'en-tête

- Porte le nom de l'interface ; à défaut son protocole ; à défaut un libellé générique.
- Tronqué avec une infobulle portant le texte entier, comme aujourd'hui.
- Reste la poignée de déplacement de la fiche.

#### La liste

- Un intitulé annonçant le nombre de data objects.
- Une ligne par data object : chevron (si description), nom tronqué avec infobulle.
- Le clic sur la ligne déplie la description juste en dessous ; un second clic la replie. Le chevron indique l'état.
- Plusieurs lignes peuvent être dépliées simultanément.
- Une ligne dépliée puis la fiche fermée, puis rouverte : la liste est de nouveau entièrement repliée.
- Les descriptions dépliées restent dans la zone défilante et redimensionnable.
- Aucun data object : le message actuel est conservé, et aucun intitulé de liste n'est affiché.

#### Accessibilité et gestes

- Les lignes sont actionnables au clavier et annoncent leur état déplié/replié.
- La fiche continue de ne pas voler les gestes du canevas : ni le déplacement du nœud, ni le menu contextuel, ni le clic de mise en avant.

### Non-Functional Requirements

- Aucune donnée supplémentaire : les data objects d'une interface, nom et description compris, sont déjà chargés avec le nœud.
- Aucune requête, aucun état persistant, aucun store.
- Couleurs par tokens ; lisible en thème clair comme en thème sombre.
- La fiche apparaît dans les exports PNG/SVG, qui capturent le rendu : son état replié ou déplié au moment de l'export est celui qui sera capturé, et le cadre de l'image s'élargit déjà pour la contenir.

## Scope

### In Scope

- Le titre de la fiche d'interface.
- La transformation du corps en liste dépliable, avec le compteur.
- Le traitement des data objects sans description.

### Out of Scope

- La fiche d'identité d'**application** (`ApplicationInfoCard`), qui a sa propre structure.
- Le menu contextuel du cercle d'interface (« Show Consumers », « Hide »).
- Ajouter des informations à la fiche (external id du data object, interfaces voisines, applications reliées).
- Rendre les descriptions cliquables, sélectionnables autrement, ou les faire pointer vers une fiche de data object — qui n'existe pas.
- Persister l'état déplié.

## Affected Areas

- `components/discover/InterfaceInfoCard.tsx` — l'en-tête, le corps, et rien d'autre.
- `components/icons/ChevronIcon.tsx` — réemployé tel quel, avec la même rotation qu'ailleurs.
- `components/discover/infoCardGestures.tsx` — déplacement et redimensionnement, inchangés.

## Edge Cases

- **Aucun data object** : message inchangé, pas de compteur, titre toujours celui de l'interface.
- **Un seul data object** : la liste n'a qu'une ligne (voir question ouverte).
- **Interface sans nom** : le protocole prend le relais, puis un libellé générique.
- **Deux interfaces de même nom**, fiches ouvertes en même temps : les titres sont identiques. C'est le modèle qui est ainsi ; rien n'est inventé pour les distinguer.
- **Nom de data object très long** : tronqué, infobulle complète.
- **Description très longue** : elle allonge la zone défilante, ce qui est le comportement attendu d'une ligne qu'on vient d'ouvrir volontairement.
- **Beaucoup de data objects** : la liste défile, mais le compteur reste visible au-dessus.
- **Description vide ou réduite à des espaces** : traitée comme absente — pas de chevron.
- **Fiche redimensionnée puis ligne dépliée** : la hauteur choisie par l'utilisateur est conservée, le contenu défile à l'intérieur.
- **Export pendant qu'une ligne est dépliée** : l'image montre la fiche telle qu'elle est à l'écran.

## Open Questions

1. **Un seul data object : faut-il le déplier d'emblée ?** Il n'y a alors rien à compter, et la description est tout ce que la fiche a à dire — un clic supplémentaire pour rien. **Recommandation : oui**, déplié automatiquement quand il n'y en a qu'un ; la ligne reste repliable. => suivre recommendation

2. **Faut-il reprendre la pastille de couleur du data object** dans la liste, quand le code couleur du diagramme est allumé ? Cela relierait la fiche aux pastilles des flux et aux camemberts. **Recommandation : oui**, c'est la même légende, et une couleur affichée à un endroit et pas à l'autre se remarque. => suivre recommendation


3. **La hauteur par défaut du corps** (200 px aujourd'hui) doit-elle baisser, puisque les lignes repliées sont bien plus compactes ? **Recommandation : la conserver** — elle montre désormais une liste entière au lieu d'une description et demie, ce qui est exactement le gain recherché. => suivre recommendation


## Acceptance Criteria

1. La fiche d'une interface porte le **nom de l'interface** en en-tête.
2. Une interface sans nom affiche son protocole ; sans protocole, un libellé générique.
3. Le corps affiche un intitulé portant le nombre de data objects, puis une ligne par data object, toutes repliées.
4. Le premier data object a sa propre ligne, comme les autres.
5. Un clic sur une ligne déplie sa description ; un second la replie ; le chevron suit l'état.
6. Deux lignes peuvent être ouvertes en même temps.
7. Fermer puis rouvrir la fiche rend la liste entièrement repliée.
8. Un data object sans description n'a pas de chevron, et son nom reste aligné avec les autres.
9. Une interface sans data object affiche le message existant, sans compteur.
10. Le déplacement par l'en-tête, le redimensionnement du corps, la fermeture et la ligne Protocole fonctionnent comme avant.
11. Le canevas ne reçoit ni clic ni déplacement à travers la fiche.
12. `npx tsc --noEmit` et `npm run build` passent ; aucune erreur en console sur `/discover`.
