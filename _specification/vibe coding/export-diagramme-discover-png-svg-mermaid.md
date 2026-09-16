# Feature Spec: Export du diagramme Discover (PNG, SVG, Mermaid)

## Summary
- La page `/discover` ne permet aujourd'hui aucune sortie : le graphe construit à l'écran ne peut être ni archivé, ni collé dans un document, ni rejoué ailleurs.
- Ajouter un **bouton « Export »** dans la barre d'outils, **à gauche de l'icône d'engrenage** (`DiscoverDisplaySettings`), ouvrant un petit menu de trois entrées : **PNG**, **SVG**, **Mermaid**.
- **Cette itération implémente uniquement l'export Mermaid** : le diagramme visible est traduit en texte Mermaid et téléchargé comme fichier. Les entrées PNG et SVG existent dans le menu mais restent inactives (voir Décisions).
- L'application étant déployée **hors ligne**, toute bibliothèque nécessaire est installée comme **dépendance npm** et embarquée dans le bundle — aucun chargement depuis un CDN, ni au build ni à l'exécution.

## Motivation
- Le graphe Discover est un travail d'exploration : l'utilisateur sélectionne des applications, déplie leurs interfaces, masque ce qui l'encombre. Ce résultat, aujourd'hui, meurt avec l'onglet.
- Les besoins réels sont de trois natures différentes, d'où trois formats :
  - **PNG** — coller dans une slide, un mail, un ticket ;
  - **SVG** — intégrer dans un document en gardant la netteté et le texte sélectionnable ;
  - **Mermaid** — obtenir une représentation **textuelle, versionnable et réutilisable**, qui se colle dans une documentation Markdown, se rejoue dans un autre outil, et se relit dans dix ans sans dépendre du rendu de cette page.
- Le catalogue a déjà son export PDF ; Discover n'a rien. L'écart est d'autant plus visible que c'est la vue qui produit l'information la plus coûteuse à reconstituer à la main.

## Décisions (arbitrées)

### Emplacement et forme du contrôle
- Un bouton icône **à gauche de l'engrenage**, dans le bloc de droite de la barre d'outils de `/discover`, au même gabarit que lui (carré, bordure, fond `surface`).
- Un clic ouvre un **menu** ancré sous le bouton, avec une entrée par format. La mécanique d'ouverture/fermeture reprend **exactement** celle de `DiscoverDisplaySettings` (fermeture sur Échap et sur clic extérieur), pour que les deux popovers se comportent pareil.
- Le menu se ferme dès qu'un export est déclenché.

### Périmètre de l'export : ce qui est à l'écran
- L'export porte sur **le graphe tel qu'il est** au moment du clic : applications sélectionnées, applications ajoutées par exploration, interfaces dépliées, liens tracés.
- Ce qui a été **masqué** (action « Hide ») est **absent** de l'export. Un nœud masqué n'existe plus pour le graphe, il ne doit pas réapparaître dans la sortie.
- Le zoom, le recentrage et les positions de nœuds ne portent aucune information pour Mermaid (dont la mise en page est recalculée par le moteur de rendu) ; ils compteront en revanche pour PNG et SVG, qui capturent la vue.

### Ce que contient le Mermaid produit
- Un **flowchart** orienté, reprenant fidèlement le modèle du graphe : les **applications** et les **interfaces** sont deux catégories de nœuds distinctes, et chaque lien va d'une **application consommatrice** vers l'**interface** qu'elle consomme, dans le même sens que la flèche affichée.
- Le rattachement d'une interface à l'**application qui la fournit** doit rester lisible dans la sortie : à l'écran, l'interface est un nœud enfant de son fournisseur ; en Mermaid, ce rattachement doit être exprimé (regroupement ou lien dédié — forme à trancher au plan), sinon on perd l'information centrale du diagramme.
- Les **applications sélectionnées** (racines) doivent rester distinguables des applications amenées par exploration, comme elles le sont visuellement.
- Le fichier est **autonome et valide** : il s'ouvre tel quel dans n'importe quel rendu Mermaid, sans retouche.

### Contrainte hors ligne
- Toute bibliothèque retenue est ajoutée aux `dependencies` de `package.json` avec une **version exacte** (le fichier n'utilise ni `^` ni `~`), et résolue au build. Aucune référence à un CDN, aucun `import()` d'URL distante.
- Le chargement de la bibliothèque doit rester **paresseux**, comme l'est déjà `@react-pdf/renderer` dans `useApplicationActions` : `/discover` est déjà une page lourde, l'outillage d'export ne doit pas entrer dans son bundle initial.
- **Point à trancher avant d'installer quoi que ce soit** : produire du *texte* Mermaid ne requiert **aucune** bibliothèque — c'est une simple sérialisation. Le paquet `mermaid` est un **moteur de rendu** (texte → SVG) ; il n'est justifié que si l'on veut, en plus, prévisualiser le diagramme ou produire PNG/SVG *via* Mermaid. Voir Open Questions : la réponse change la taille du bundle de plusieurs Mo.

### Nommage et déclenchement du téléchargement
- Nom de fichier horodaté, sur le modèle de l'export PDF du catalogue (`application-export-<YYYY-MM-DD>.pdf`), avec l'extension propre au format.
- Téléchargement déclenché côté navigateur, sans appel réseau ni aller-retour serveur.

### PNG et SVG dans cette itération
- Les deux entrées sont **visibles mais désactivées**, avec une indication explicite qu'elles arriveront plus tard. Montrer la structure complète du menu dès maintenant évite de le redessiner, et annonce l'intention.
- Leur implémentation relève d'une mécanique tout autre — capture du canvas React Flow — et fera l'objet d'une itération distincte.

## Requirements

### Functional Requirements
- Un bouton « Export » est présent dans la barre d'outils de `/discover`, immédiatement à gauche du bouton de réglages d'affichage.
- Un clic ouvre un menu listant PNG, SVG et Mermaid ; Échap et un clic à l'extérieur le ferment.
- L'entrée Mermaid produit et télécharge un fichier texte Mermaid décrivant le graphe affiché.
- Le fichier produit est un diagramme Mermaid **valide**, rendu sans erreur par un moteur Mermaid standard.
- Les applications, les interfaces, le sens des liens et le rattachement interface → application fournisseur sont tous restitués.
- Les nœuds masqués n'apparaissent pas dans la sortie.
- Les entrées PNG et SVG sont visibles et clairement inactives.
- Le bouton d'export est inopérant (ou désactivé) tant que le graphe est vide.

### Non-Functional Requirements
- **Hors ligne** : aucune ressource distante, ni au build ni à l'exécution. Toute dépendance est déclarée dans `package.json` en version exacte.
- **Bundle** : aucune augmentation du chargement initial de `/discover` ; l'outillage d'export est importé à la demande.
- **Aucun appel réseau** au moment de l'export.
- Le menu respecte les tokens de thème (`--color-*`) et reste lisible en thème clair comme sombre.
- Accessibilité : bouton étiqueté, menu navigable au clavier, fermeture au clavier.
- L'export d'un graphe de plusieurs centaines de nœuds ne doit pas figer l'interface de façon perceptible.
- Aucune régression sur le graphe lui-même : l'export est en lecture seule, il ne déplace, ne recentre et ne resélectionne rien.

## Scope

### In Scope
- Le bouton d'export et son menu à trois entrées.
- L'implémentation complète de l'export Mermaid (sérialisation + téléchargement).
- L'ajout et le verrouillage de version de la (des) dépendance(s) nécessaires, compatibles hors ligne.

### Out of Scope
- L'implémentation des exports PNG et SVG (spécifiés, non réalisés ici).
- Toute prévisualisation du diagramme Mermaid dans l'application.
- L'export depuis le catalogue ou la carte, qui ont leurs propres actions.
- La personnalisation du rendu Mermaid (thème, direction, mise en page) par l'utilisateur.
- La réimportation d'un fichier Mermaid pour reconstruire un graphe.
- La copie dans le presse-papiers (le téléchargement est le seul canal de cette itération).

## Affected Areas
- **Modifier** : `components/DiscoverClient.tsx` — la barre d'outils, où l'engrenage est monté dans un `div.ml-auto` ; le bouton d'export prend place juste avant lui.
- **Créer** : un composant de menu d'export sous `components/discover/`, calqué sur `components/discover/DiscoverDisplaySettings.tsx` pour la mécanique du popover (Échap, clic extérieur, ancrage).
- **Créer** : une icône d'export sous `components/icons/`, au format des icônes existantes (`{ size, className }`, `viewBox="0 0 24 24"`, `aria-hidden`).
- **Créer** : un module de sérialisation vers Mermaid, sans JSX, testable à part — il ne doit connaître que le modèle de nœuds et de liens, jamais React Flow.
- **Point structurel à traiter** : `components/discover/DiscoverGraph.tsx` n'expose aujourd'hui, via son `useImperativeHandle`, que `addApplication` et `removeApplication`. Le menu d'export a besoin de **lire** l'état courant du graphe (nœuds visibles, interfaces, liens, quelles applications sont racines). Il faut soit étendre cette interface impérative, soit remonter le menu à l'intérieur du graphe. À trancher au plan — c'est le vrai point de conception de cette feature.
- **Réutiliser** : le schéma de téléchargement déjà écrit dans `components/useApplicationActions.tsx` (`Blob` → `URL.createObjectURL` → ancre synthétique → `revokeObjectURL`), plutôt que d'en réinventer un.
- **Modifier** : `package.json` — nouvelle(s) dépendance(s) en version exacte.
- **Non touché** : le rendu du graphe (`ApplicationNode`, `InterfaceNode`, `GraphEdge`), la sélection, le menu contextuel, `lib/discoverSeed.ts`.

## Edge Cases
- **Graphe vide** → pas de fichier vide ni de diagramme sans nœud : l'action est indisponible.
- **Application sans aucune interface** → doit tout de même apparaître comme nœud isolé, comme elle apparaît à l'écran.
- **Interface sans consommateur affiché** → rattachée à son fournisseur, sans lien entrant.
- **Caractères spéciaux dans les libellés** — guillemets, crochets, parenthèses, accolades, accents, retours à la ligne — cassent la syntaxe Mermaid s'ils ne sont pas échappés. C'est le piège principal de cette feature.
- **Identifiants** : les ids sont des UUID techniques LeanIX de 36 caractères contenant des tirets ; ils doivent être transformés en identifiants Mermaid valides, de façon **stable et sans collision**.
- **Deux applications de même nom** → doivent rester deux nœuds distincts (l'identité vient de l'id, jamais du libellé).
- **Boucles et liens réciproques** (A consomme une interface de B qui consomme une interface de A) → doivent être rendus sans casser la génération.
- **Très grand graphe** (plusieurs centaines de nœuds) → le fichier est produit sans blocage, même si son rendu ultérieur par un moteur Mermaid peut être long — ce qui n'est pas de notre ressort.
- **Réglages d'affichage** (`DiscoverDisplaySettings` : nom, external ID, manager) → l'export doit être cohérent avec ce qui est affiché, ou assumer explicitement de ne pas l'être (voir Open Questions).
- **Deux exports successifs** → deux fichiers, aucun état résiduel, aucun nom en collision.
- **Rappel hors ligne** : `app/globals.css` importe aujourd'hui les polices depuis Google Fonts. Cet import échouera dans un déploiement sans accès Internet. Ce n'est pas l'objet de cette spec, mais c'est le même angle mort et il mérite un ticket à part.

## Open Questions
- **Faut-il réellement la bibliothèque `mermaid` ?** Générer le texte `.mmd` ne demande aucune dépendance. Le paquet `mermaid` (plusieurs Mo, moteur de rendu) ne devient nécessaire que si l'on veut prévisualiser le diagramme dans l'application, ou produire les futurs PNG/SVG **à partir du Mermaid** plutôt qu'en capturant le canvas. Quel est l'usage visé ? => On va vouloir effectivement visualiser au format mermaid mais dans drawIO

- **Cohérence avec les réglages d'affichage** : le libellé d'un nœud exporté doit-il suivre les commutateurs Nom / External ID / Application Manager, ou toujours porter le même contenu quel que soit l'affichage ? => toujours le mêe contenu

- **Expression du rattachement interface → fournisseur** : regroupement par application (sous-graphe) ou lien explicite du fournisseur vers son interface ? Le premier est plus fidèle à l'écran, le second plus simple à relire en texte. =>  Option B — un lien explicite      fournisseur → interface

- **PNG et SVG** : entrées désactivées comme proposé ici, ou faut-il les livrer dans la même itération ? => non

## Acceptance Criteria
- [ ] Un bouton d'export est visible à gauche de l'engrenage sur `/discover`, au même gabarit.
- [ ] Il ouvre un menu de trois entrées — PNG, SVG, Mermaid — qui se ferme sur Échap et au clic extérieur.
- [ ] PNG et SVG sont visibles et clairement inactives.
- [ ] Mermaid télécharge un fichier au nom horodaté, sans appel réseau.
- [ ] Le fichier obtenu est rendu sans erreur par un moteur Mermaid standard.
- [ ] Applications, interfaces, sens des liens et rattachement au fournisseur sont tous restitués ; les applications sélectionnées restent distinguables.
- [ ] Un nœud masqué via « Hide » n'apparaît pas dans le fichier.
- [ ] Des libellés contenant guillemets, parenthèses et accents ne cassent pas la syntaxe.
- [ ] Deux applications homonymes donnent deux nœuds distincts.
- [ ] Aucune ressource distante n'est requise ; les dépendances ajoutées sont en version exacte dans `package.json`.
- [ ] Le chargement initial de `/discover` n'embarque pas l'outillage d'export.
- [ ] Le graphe est inchangé après un export (positions, zoom, sélection).
- [ ] Build Next OK, aucune régression sur `/discover`.
