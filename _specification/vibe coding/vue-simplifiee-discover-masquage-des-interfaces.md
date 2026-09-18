# Feature Spec: Vue simplifiée du diagramme Discover (masquage des interfaces)

## Summary
- La vue Discover actuelle expose la notion d'**interface** héritée de LeanIX : chaque flux passe par un petit cercle accroché à l'application qui le fournit. C'est fidèle au modèle, mais dense et difficile à lire pour qui veut simplement savoir « qui parle à qui ».
- Ajouter une **vue simplifiée** où les interfaces ne sont plus dessinées et où les flèches relient **directement les applications**.
- Exemple de référence : si l'application **A** consomme les interfaces **I1** et **I2** exposées par **B**, la vue complexe montre `A → I1` et `A → I2` ; la vue simplifiée montre une **seule** flèche `A → B`.
- Un **commutateur Simple / Complexe** dans la barre d'outils, **à gauche de l'icône d'export**, bascule d'un mode à l'autre.

## Motivation
- Les interfaces sont un détail d'implémentation du référentiel, pas la question que se pose l'utilisateur. Sur un graphe de quelques dizaines d'applications, les cercles et leurs liens multiplient les objets à l'écran sans ajouter d'information sur la **dépendance entre applications**, qui est ce qu'on vient chercher.
- Deux applications reliées par cinq interfaces produisent aujourd'hui cinq traits. La vue simplifiée dit la même chose en un seul, et rend enfin comparables des couples d'applications qui ne l'étaient pas.
- Le diagramme devient partageable : une vue « applications seulement » se montre en réunion ou se colle dans un document, là où la vue interfaces demande une explication préalable du modèle LeanIX.
- Le besoin est symétrique de celui qui a motivé l'export : sortir de l'exploration un artefact lisible par quelqu'un qui n'a pas construit le graphe.

## Décisions (arbitrées)

### Une projection, pas un second graphe
- Le modèle sous-jacent **ne change pas** : les interfaces restent la structure de données, parce que c'est par elles que passe toute l'exploration (on ne trouve les consommateurs et les fournisseurs d'une application qu'en traversant ses interfaces).
- La vue simplifiée est une **projection à l'affichage** : les nœuds d'interface ne sont pas rendus, et les liens sont recalculés d'application à application.
- Conséquence voulue : la bascule est **instantanée et sans perte**. Rien n'est refetché, rien n'est oublié, et repasser en vue complexe restitue exactement le graphe précédent.

### Règle de repliement des flèches
- Tout lien `consommateur → interface` devient un lien `consommateur → application fournissant cette interface`.
- Les doublons sont **fusionnés** : plusieurs interfaces d'un même fournisseur consommées par une même application donnent **une seule** flèche.
- Le **sens est conservé** : la flèche part du consommateur vers le fournisseur, exactement comme aujourd'hui. On ne l'inverse pas au prétexte que la donnée circule dans l'autre sens ; changer le sens entre les deux vues serait le meilleur moyen de faire lire un diagramme à l'envers.
- Deux applications qui se consomment **mutuellement** gardent **deux** flèches, une par sens.

### Le commutateur
- Placé dans le bloc de droite de la barre d'outils, **à gauche du bouton Export** — l'ordre devient : commutateur, export, réglages d'affichage.
- Le mode courant doit être **lisible sans interaction** : ce n'est pas une icône muette mais un contrôle qui nomme l'état actif.
- Le choix est **mémorisé localement**, comme le sont déjà les réglages d'affichage de Discover et l'état déplié des chapitres de filtres.

### Ce que devient l'exploration
- « Show Consumers » et « Show providers » gardent tout leur sens en vue simplifiée : ce sont des verbes qui parlent d'applications.
- « Show API », en revanche, ne sert **qu'à** faire apparaître des cercles d'interface. En vue simplifiée, elle n'a plus d'objet et ne doit pas rester offerte comme si elle agissait.
- Le menu contextuel des interfaces disparaît mécaniquement : il n'y a plus de cercle à viser.

### Cohérence avec l'export
- L'export Mermaid doit **suivre le mode affiché** : en vue simplifiée, le fichier ne contient que des applications et des liens directs, sans les nœuds d'interface ni les liens `provides`.
- Un export doit décrire ce que l'utilisateur regarde, sinon il faut expliquer l'écart à chaque fois qu'on partage le fichier.

## Requirements

### Functional Requirements
- Un commutateur Simple / Complexe est présent à gauche du bouton d'export et indique le mode actif.
- En vue simplifiée, aucun nœud d'interface n'est visible.
- En vue simplifiée, chaque couple (consommateur, fournisseur) relié par au moins une interface est représenté par exactement une flèche, dans le sens consommateur → fournisseur.
- La bascule entre les deux modes est immédiate, sans rechargement ni nouvelle requête.
- Les applications présentes, masquées ou sélectionnées sont **les mêmes** dans les deux vues.
- Les actions d'exploration portant sur les applications restent disponibles en vue simplifiée ; celles qui ne concernent que les interfaces n'y sont pas proposées.
- Le choix du mode est restitué à la réouverture de la page.
- L'export Mermaid reflète le mode courant.

### Non-Functional Requirements
- **Aucun appel réseau** déclenché par la bascule : tout est déjà en mémoire.
- Aucun état perdu au passage d'un mode à l'autre, dans les deux sens.
- Le repliement des liens ne doit pas dégrader la fluidité sur un graphe de plusieurs centaines de nœuds.
- Lisibilité en thème clair et sombre ; le commutateur suit les tokens `--color-*`.
- Accessibilité : le contrôle est étiqueté, utilisable au clavier, et son état est annoncé.
- Aucune régression sur le déplacement des nœuds, le zoom, le menu contextuel, la sélection ou le masquage.

## Scope

### In Scope
- Le commutateur et la mémorisation du mode.
- La projection du graphe en mode simplifié : masquage des interfaces, repliement et dédoublonnage des liens.
- L'adaptation du menu contextuel au mode courant.
- L'alignement de l'export Mermaid sur le mode affiché.

### Out of Scope
- Toute modification du modèle de données ou des requêtes LeanIX.
- Un troisième mode d'affichage, ou un réglage plus fin (par exemple masquer certaines interfaces seulement).
- L'affichage du détail des interfaces repliées (liste, panneau latéral) au survol d'une flèche.
- Les exports PNG et SVG, toujours non implémentés.
- Le partage du mode via l'URL.

## Affected Areas
- **Modifier** : `components/discover/DiscoverGraph.tsx` — c'est là que tout se joue. Les nœuds rendus et le mémo qui dérive les arêtes (aujourd'hui groupées par interface, avec une géométrie calculée entre la boîte du consommateur et le cercle de l'interface) doivent produire, en mode simplifié, des arêtes entre deux rectangles d'application.
- **Réutiliser** : la géométrie d'arête déjà écrite dans ce fichier (centre de boîte, découpe au bord du rectangle, courbure alternée pour les liens parallèles) et le composant `components/discover/GraphEdge.tsx` — le tracé ne change pas, seules les extrémités changent.
- **Réutiliser** : la table interface → fournisseur déjà tenue par le graphe, qui est exactement la donnée nécessaire au repliement ; il n'y a rien à recalculer.
- **Créer** : un petit magasin de mode d'affichage, sur le modèle de `lib/discoverDisplaySettings.ts` (état partagé + persistance locale + abonnement).
- **Créer** : le composant du commutateur, sous `components/discover/`.
- **Modifier** : `components/DiscoverClient.tsx` — insertion du commutateur avant `DiscoverExportMenu` dans le bloc de droite de la barre d'outils.
- **Modifier** : `components/discover/NodeContextMenu.tsx` — l'action propre aux interfaces n'est pas proposée en vue simplifiée.
- **Modifier** : l'instantané exposé par le graphe et `lib/discoverMermaid.ts` — pour que l'export suive le mode.
- **Non touché** : `components/discover/InterfaceNode.tsx` (simplement pas rendu), `lib/discover-graph-adapter.ts`, les requêtes LeanIX, la sélection et les chips.

## Edge Cases
- **Interface affichée sans aucun consommateur visible** → en vue simplifiée elle ne produit **aucune** flèche. L'utilisateur qui vient de faire « Show API » en vue complexe puis bascule voit son action sans effet apparent : à assumer explicitement, voire à signaler.
- **Application sans aucun lien** → reste affichée comme nœud isolé, dans les deux vues.
- **Interface masquée individuellement** en vue complexe → sa disparition retire potentiellement une flèche `A → B` en vue simplifiée, sans que rien n'explique pourquoi. Cas à ne pas laisser silencieux.
- **Auto-consommation** (une application consommant une interface qu'elle fournit elle-même) → produit une boucle sur elle-même ; il faut décider si on la dessine ou si on l'ignore.
- **Consommation réciproque** A ↔ B → deux flèches, qui ne doivent pas se superposer au point de n'en former qu'une visuellement.
- **Positions des nœuds** : les cercles d'interface occupent une couronne autour de chaque application, et l'espacement des applications en tient compte. En vue simplifiée, cette place devient vide — le graphe paraîtra aéré. Recalculer la disposition le rendrait plus compact mais ferait sauter tout le graphe et **effacerait les déplacements manuels** de l'utilisateur.
- **Bascule pendant un chargement** (interfaces en cours de récupération) → ne doit ni geler l'interface, ni afficher un graphe à moitié replié.
- **Masquer une application** en vue simplifiée → doit produire exactement le même élagage qu'en vue complexe, interfaces orphelines comprises.
- **Très grand graphe** → le dédoublonnage doit rester linéaire, sans comparaison de paires en O(n²).
- **Export juste après une bascule** → le fichier correspond au mode affiché au moment du clic, jamais au précédent.

## Open Questions
- **Mode par défaut** : la vue complexe reste-t-elle le défaut (aucun changement pour l'existant), ou la vue simplifiée devient-elle l'entrée naturelle, la complexe étant réservée à qui la demande ? => vue complexe est celle par défaut

- **Libellé des modes** : « Simple / Complexe » comme formulé dans la demande, ou une paire qui nomme ce qui change — par exemple « Applications / Interfaces » ? => Simple/Complex

- **Information portée par la flèche repliée** : faut-il indiquer le nombre d'interfaces fusionnées sur le lien (`A → B` avec un « 3 »), ou la flèche reste-t-elle nue ? C'est la seule information réellement perdue par le repliement. => non pas d'information dans cette version

- **Disposition** : conserver les positions actuelles à la bascule (stable, respecte les déplacements manuels, mais laisse des vides), ou recalculer une disposition compacte à chaque changement de mode ? => conserve

- **« Show API » en vue simplifiée** : masquer l'action, ou la conserver en la faisant basculer automatiquement vers la vue complexe puisque c'est la seule où elle a un sens ? => masquer

## Acceptance Criteria
- [ ] Un commutateur Simple / Complexe est visible à gauche du bouton d'export et indique clairement le mode actif.
- [ ] En vue simplifiée, aucun cercle d'interface n'est affiché.
- [ ] Une application consommant plusieurs interfaces d'un même fournisseur n'affiche qu'**une** flèche vers lui.
- [ ] Le sens des flèches est identique dans les deux vues.
- [ ] Une consommation réciproque produit deux flèches distinctes et lisibles.
- [ ] La bascule est immédiate, sans appel réseau, et aller-retour entre les modes restitue le graphe à l'identique.
- [ ] Les applications visibles, masquées et sélectionnées sont les mêmes dans les deux modes.
- [ ] Les actions d'exploration par application restent disponibles en vue simplifiée.
- [ ] Le mode choisi est retrouvé après rechargement de la page.
- [ ] L'export Mermaid produit un fichier sans interfaces lorsque la vue simplifiée est active, et avec interfaces sinon.
- [ ] Aucune régression sur le déplacement des nœuds, le zoom, le masquage ou le menu contextuel.
- [ ] Build Next OK.
