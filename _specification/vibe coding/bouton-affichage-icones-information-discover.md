# Feature Spec: Bouton d'Affichage des Icônes d'Information dans Discover

## Summary
- Ajouter dans la barre d'outils de Discover un **bouton icône « Information »**, placé **entre le sélecteur Simple/Complex et le bouton d'export**.
- Ce bouton **affiche ou masque les icônes d'information** portées par les nœuds du diagramme : celle du rectangle d'application (`ApplicationNode`) et celle du cercle d'interface (`InterfaceNode`).
- Le bouton est un **interrupteur à deux états visuellement distincts** : actif (icônes affichées) et inactif (icônes masquées), l'état courant se lisant sans interaction.
- Quand les icônes sont masquées, la fonction qu'elles portent est **désactivée** : on ne peut plus ouvrir de carte d'identité, et une carte ouverte se ferme.
- Le réglage est une **préférence utilisateur persistante**, mémorisée avec les autres réglages d'affichage de Discover.

## Motivation
- Les deux icônes d'information sont utiles pour explorer, mais **parasitent la lecture** dès qu'on prépare une capture d'écran ou qu'on projette le diagramme en revue : sur un graphe de trente nœuds, ce sont trente pastilles qui n'apportent rien à ce moment-là.
- Le cas est particulièrement marqué sur le **cercle d'interface**, minuscule, où l'icône occupe presque toute la surface du nœud et brouille sa lecture comme simple point de connexion.
- Le réglage existe déjà en esprit dans le panneau d'affichage (engrenage), qui permet déjà de masquer le nom, l'identifiant externe et le responsable sur les cartes. Ce qui manque, c'est un accès **immédiat**, en un clic, pour l'alternance fréquente entre « j'explore » et « je montre ».
- Un bouton dédié dans la barre, plutôt qu'une ligne de plus dans le panneau replié, parce que c'est une bascule que l'on fait souvent et que l'on veut voir dans son état courant.

## Décisions (arbitrées)
- **Emplacement** : dans le groupe d'actions à droite de la barre, entre le sélecteur de mode de vue et le bouton d'export. Même hauteur, même bordure et même fond que le bouton d'export et l'engrenage qui l'encadrent.
- **Un seul contrôle** : le bouton est le seul point de réglage. Il n'est pas dupliqué dans le panneau engrenage, pour éviter deux commandes concurrentes du même état.
- **Le réglage vit dans le store d'affichage de Discover existant** (celui des interrupteurs de contenu des cartes et de la courbure des liens), donc persistant et restauré au rechargement.
- **Masquer les icônes désactive la fonction**, elle ne la rend pas seulement invisible : aucune carte ne peut plus être ouverte, et le nœud ne doit pas dissimuler une zone cliquable fantôme.
- **Les deux natures de nœud suivent le même réglage** : une seule bascule pour les applications et les interfaces, pas deux.

## Requirements

### Functional Requirements

#### Le bouton
- Un bouton icône, portant un pictogramme d'information, placé entre le sélecteur Simple/Complex et le bouton d'export.
- Deux états visuels nettement distincts :
  - **actif** (icônes affichées) : traitement plein, à l'accent, comme le segment sélectionné du sélecteur de mode ;
  - **inactif** (icônes masquées) : traitement discret, texte atténué sur fond de surface.
- Un clic bascule l'état ; l'effet sur le diagramme est **immédiat**, sans rechargement.
- Infobulle explicite sur ce que fait le bouton, dans le vocabulaire des autres infobulles de la barre.
- Le bouton reste utilisable en toutes circonstances, y compris canevas vide — contrairement au bouton d'export, qui se désactive faute de contenu.
- Il s'aligne visuellement avec ses voisins : même hauteur, même rayon de bordure, même comportement au survol et au focus clavier.

#### Effet sur le diagramme
- **Actif** : les rectangles d'application et les cercles d'interface affichent leur icône d'information, comme aujourd'hui.
- **Inactif** :
  - aucune icône d'information n'est rendue sur les nœuds ;
  - aucune carte d'identité ne peut être ouverte, ni depuis une application ni depuis une interface ;
  - une carte ouverte au moment du basculement **se ferme** ;
  - le nœud ne conserve aucune zone cliquable invisible à l'emplacement de l'icône.
- Le réglage n'affecte **que** les icônes d'information : le nom, l'identifiant externe, le responsable, le redimensionnement des rectangles, le menu contextuel, la mise en évidence au survol et la sélection restent inchangés.
- Le réglage s'applique dans les deux modes de vue, sachant qu'en mode Simple les cercles d'interface ne sont pas rendus.

#### Persistance
- L'état est mémorisé durablement dans le navigateur, avec les autres réglages d'affichage de Discover.
- Il survit au rechargement et à la fermeture de l'onglet.
- Valeur par défaut : **actif**, c'est-à-dire le comportement actuel — un utilisateur qui ne touche à rien ne voit aucun changement.
- Une valeur persistée invalide retombe silencieusement sur le défaut.

### Non-Functional Requirements
- **Aucune dépendance nouvelle**, aucun appel réseau.
- **Aucun recalcul de disposition** : masquer les icônes ne déplace aucun nœud et ne modifie ni la taille des rectangles ni celle des cercles.
- **Accessibilité** : le bouton est atteignable au clavier, expose son état pressé/non pressé aux technologies d'assistance, et porte un libellé explicite. L'état ne se devine pas par la seule couleur.
- **Thèmes** : rendu correct en clair comme en sombre, en réutilisant les jetons de couleur existants.

## Scope

### In Scope
- Nouveau réglage booléen dans le store d'affichage de Discover, avec sa valeur par défaut et sa validation à la restauration.
- Nouveau composant bouton dans la barre d'outils, inséré entre le sélecteur de mode et l'export.
- Prise en compte du réglage dans le rectangle d'application et le cercle d'interface : rendu de l'icône et accès à la carte.
- Fermeture de la carte ouverte au moment où les icônes sont masquées.

### Out of Scope
- Deux réglages séparés pour les applications et les interfaces.
- Ajout d'une ligne équivalente dans le panneau engrenage.
- Masquer d'autres éléments des nœuds (nom, identifiant, responsable), déjà couverts par le panneau existant.
- Toute modification du contenu des cartes d'identité, de leur mise en page ou de leurs gestes.
- Le menu contextuel des nœuds, la mise en évidence des liens, le redimensionnement des rectangles.
- Les exports (PNG, SVG, Mermaid) et le seed Discover partagé.
- Le graphe étoile de la fiche application et le catalogue.

## Affected Areas
- **Modifier** :
  - `lib/discoverDisplaySettings.ts` — nouveau booléen, défaut, validation.
  - `components/DiscoverClient.tsx` — insertion du bouton dans le groupe d'actions, à sa place exacte.
  - `components/discover/ApplicationNode.tsx` — rendu conditionnel de l'icône et de son accès à la carte.
  - `components/discover/InterfaceNode.tsx` — idem pour le cercle.
  - `components/discover/DiscoverGraph.tsx` — fermeture de la carte ouverte quand le réglage passe à « masqué ».
- **Créer** : le composant du bouton, dans `components/discover/`.
- **Non touché** : `components/discover/DiscoverDisplaySettings.tsx` (le panneau engrenage), `ApplicationInfoCard`, `InterfaceInfoCard`, `DiscoverExportMenu`, `DiscoverViewModeToggle`, le moteur du graphe et sa disposition.

## Edge Cases
- **Carte ouverte au moment du basculement** : elle se ferme, sans état résiduel.
- **Icônes masquées puis clic là où se trouvait l'icône** : rien ne se passe, et le clic garde le comportement normal du nœud (mise en évidence des liens).
- **Canevas vide** : le bouton reste actif et bascule sans effet visible.
- **Mode Simple** : seules les icônes des rectangles sont concernées, les cercles n'étant pas rendus.
- **Bascule Simple ↔ Complex** avec les icônes masquées : elles restent masquées dans les deux modes.
- **Rechargement** : l'état est restauré ; si les icônes étaient masquées, aucune icône n'apparaît même brièvement au premier rendu.
- **Stockage indisponible** (navigation privée) : défaut appliqué, réglage utilisable pour la session, aucune erreur.
- **Nœud survolé au moment du masquage** : aucune icône fantôme ne subsiste au survol.

## Open Questions
- **Pictogramme du bouton** : le même pictogramme d'information que celui porté par les nœuds, ou une variante barrée quand le réglage est inactif ? Recommandation : **le même pictogramme**, l'état étant porté par le traitement plein/discret comme pour le sélecteur de mode — une icône barrée ajouterait un second signal redondant. => suivre recommendation

- **Infobulle** : formulation unique, ou dépendante de l'état (« Show info icons » / « Hide info icons ») ? Recommandation : **dépendante de l'état**, elle annonce alors l'action à venir et lève l'ambiguïté de lecture du bouton. => suivre recommendation

- **Portée du masquage sur le clic du nœud** : masquer l'icône doit-il aussi empêcher l'ouverture de la carte par un éventuel autre chemin (double-clic sur le nœud, par exemple) ? Recommandation : **oui par principe**, mais aucun autre chemin n'existe aujourd'hui — rien à faire tant que c'est le cas. => suivre recommendation

- **Position exacte** : bien entre le sélecteur de mode et l'export, comme demandé — à confirmer visuellement, le groupe comptant alors quatre commandes alignées à droite. => oui

## Acceptance Criteria
- [ ] Un bouton icône d'information est présent dans la barre de Discover, **entre** le sélecteur Simple/Complex et le bouton d'export.
- [ ] Son état actif et son état inactif sont visuellement distincts et lisibles sans interaction.
- [ ] Un clic bascule l'état, avec effet immédiat sur le diagramme.
- [ ] À l'état actif, les icônes d'information des rectangles d'application et des cercles d'interface sont affichées et ouvrent leur carte.
- [ ] À l'état inactif, aucune icône n'est rendue et aucune carte ne peut être ouverte, ni sur une application ni sur une interface.
- [ ] Une carte ouverte se ferme lorsque l'on masque les icônes.
- [ ] Aucune zone cliquable invisible ne subsiste à l'emplacement d'une icône masquée.
- [ ] Le réglage est conservé après rechargement **et** après fermeture puis réouverture de l'onglet ; les icônes masquées ne réapparaissent pas fugitivement au premier rendu.
- [ ] Le défaut correspond au comportement actuel (icônes affichées).
- [ ] Aucun nœud ne se déplace et aucune taille ne change lors de la bascule.
- [ ] Le bouton est utilisable au clavier, expose son état, et fonctionne en mode clair comme en mode sombre.
- [ ] Aucune régression sur le sélecteur de mode, l'export, le panneau engrenage, le menu contextuel, le contenu des cartes et la mise en évidence des liens.
