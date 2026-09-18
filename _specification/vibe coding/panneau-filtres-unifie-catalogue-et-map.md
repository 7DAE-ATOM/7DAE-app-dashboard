# Feature Spec: Panneau de filtres unifié entre Catalogue et Map

## Summary
- Le panneau de filtres n'a pas le même rendu sur `/` (catalogue) et sur `/map`, alors qu'il doit être **le même composant, avec la même apparence**.
- Diagnostic (vérifié dans le code) : **c'est déjà le même composant**. `components/FilterBar.tsx` et `components/FilterSheet.tsx` sont rendus à l'identique par `CatalogueClient` et par `MapClient`. Les écarts visuels ne viennent pas du composant mais de **ce qui l'entoure et de ce qu'on lui passe** :
  - `/map` l'enveloppe dans une carte `glass-panel p-5` (fond translucide, bordure, ombre, coins arrondis) ; `/` l'enveloppe dans un simple `div` `sticky` **sans encadrement** ;
  - `/map` coiffe le panneau d'un titre « Applications by location » et d'un sous-titre « No location data available yet » que le catalogue n'a pas ;
  - `/` passe les props `actions` (rangée ACTIONS : Export PDF, Show in Discover) et `previewCount` (compteur par option) ; `/map` ne les passe pas, donc ces deux blocs y sont **absents**.
- Cette spec aligne les quatre points : encadrement identique des deux côtés, suppression du titre parasite sur `/map`, rangée ACTIONS présente sur `/map`, et compteurs par option également sur `/map`.

## Motivation
- Deux pages qui offrent le même outil de filtrage doivent le présenter de la même façon : aujourd'hui l'utilisateur qui passe du catalogue à la carte voit un panneau différent (encadré ici, pas là) et perd des fonctions (export PDF, ouverture dans Discover, compteurs) sans explication.
- L'absence d'encadrement sur le catalogue laisse les chapitres flotter contre la grille de cartes : le panneau de `/map`, encadré, est objectivement plus lisible — c'est lui qui sert de référence.
- Le titre « Applications by location / No location data available yet » est un vestige : le même message est déjà rendu **à l'intérieur de la carte** par `components/MapView.tsx`. Le répéter au-dessus des filtres, qui ne parlent pas de localisation, est trompeur.
- Les écarts sont aujourd'hui portés par les **appelants** ; toute nouvelle fonctionnalité du panneau risque donc de n'atterrir que d'un côté (c'est exactement ce qui s'est passé pour `actions` et `previewCount`). Réduire cette surface est le vrai enjeu.

## Décisions (arbitrées)

### Le composant reste unique — on ne duplique rien
- `FilterBar` / `FilterSheet` restent les seuls composants de filtrage. Aucune variante « map » n'est créée.
- L'objectif est au contraire de **réduire les props différenciantes** : à la fin de cette itération, les deux pages doivent passer le même jeu de props, à l'exception de ce qui dépend réellement du contexte.

### L'encadrement devient commun, porté par une enveloppe partagée
- L'encadrement (bordure, fond, coins arrondis, padding) n'est mis **ni dans `FilterBar`**, ni dans chaque page : il vit dans une **petite enveloppe partagée** que `/` et `/map` montent toutes les deux autour de `FilterBar`.
- Pourquoi pas dans `FilterBar` : la feuille mobile (`FilterSheet`) est **déjà** un châssis complet — `bg-surface`, bordure haute, coins arrondis, `p-6`, poignée, titre « Filters » et bouton « Show N results ». Un cadre porté par `FilterBar` y produirait un padding cumulé (~44 px de gouttière sur mobile), une bordure sans contraste (même fond `surface` sur `surface`), des arrondis non concentriques, et un rectangle qui n'envelopperait que les filtres en laissant la poignée et le bouton de validation dehors. Il faudrait donc une prop dont l'unique rôle serait de désactiver ce qu'on vient d'ajouter — signe que le cadre n'appartient pas à `FilterBar`.
- Répartition retenue : `/` et `/map` utilisent l'enveloppe ; `FilterSheet` utilise `FilterBar` **nu** et reste maître de son propre châssis. La garantie recherchée est conservée — les deux pages ne peuvent plus diverger puisqu'elles partagent la même enveloppe.
- Rendu : **cadre plein**, pas l'effet verre. `glass-panel` (flou + translucidité) n'a de sens que superposé à des tuiles ; il n'est d'ailleurs défini que sous `.theme-map-first` (`styles/themes/map-first.css`) et resterait sans effet sur le catalogue. L'enveloppe repose sur les tokens `--color-surface` / `--color-border` / `--radius-card`, avec une géométrie identique des deux côtés.
- Sur `/map`, ce fond plein est aussi ce qui garantit la lisibilité des libellés par-dessus la carte MapLibre, en thème clair comme en thème sombre.

### Les actions apparaissent aussi sur `/map`
- La rangée ACTIONS (Export PDF, Show in Discover) doit être présente sur `/map` avec le **même comportement** que sur le catalogue : mêmes pastilles rondes, mêmes info-bulles avec compteur, même modale d'avertissement au-delà du seuil, même transport hybride du seed.
- Elle porte sur les applications **visibles après filtrage**, qui sont les mêmes des deux côtés puisque les filtres sont partagés via `lib/appFilters.ts`.
- Conséquence structurelle : toute la logique des actions (état d'export, génération du PDF, modale de confirmation, écriture du jeton de seed, ouverture de l'onglet) vit aujourd'hui **dans `CatalogueClient`**. La dupliquer dans `MapClient` est exclu : elle doit être extraite dans une unité réutilisable, montée à l'identique par les deux pages.
- Le PDF exporté depuis `/map` est le même document que depuis le catalogue (même liste, même description de filtres) : la carte ne change pas le contenu, seulement le point de départ.

### Forme de l'unité partagée : un hook, pas un composant
- L'extraction prend la forme d'un **hook** qui reçoit ce dont il a besoin (liste visible, filtres, arbre des capacités) et renvoie **deux nœuds** : la **rangée** d'actions et la **modale**. La page place la rangée dans la prop `actions` de `FilterBar` / `FilterSheet`, et monte la modale à sa racine.
- Pourquoi deux nœuds séparés et pas un composant enveloppant : la rangée doit atterrir **à l'intérieur** de `FilterBar` (sous le titre « ACTIONS »), la modale **à la racine** de la page. Un composant enveloppant classique ne rend ses enfants qu'à un seul endroit ; il lui faudrait un contexte pour couvrir les deux, soit une indirection de plus pour deux consommateurs.
- Pourquoi ne pas simplement glisser la modale dans le nœud de la rangée : la rangée est rendue **deux fois** (la colonne desktop est `hidden lg:block`, donc montée en permanence, et la feuille mobile la monte aussi). La modale, elle, doit être montée **exactement une fois**, sinon deux dialogues partagent le même `aria-labelledby` et se disputent le focus. La séparation `{ rangée, modale }` rend cette asymétrie visible dans le code de chaque page, là où un contexte la masquerait.
- Contrepartie assumée : rien n'oblige l'appelant à monter la modale ; l'oublier rend « Show in Discover » silencieux au-delà du seuil. Le risque ne porte que sur deux appelants et se voit au premier clic de vérification. Si un troisième appelant apparaît, la bascule vers un contexte reste possible sans rien changer à l'intérieur du hook.
- L'état d'export vit dans le hook, donc les deux rangées d'une même page partagent le même état et ne peuvent pas ouvrir deux modales.

### Les compteurs par option apparaissent aussi sur `/map`
- Le nombre affiché en permanence sur chaque option (`previewCount`) doit être présent sur `/map`, calculé sur **la liste de `/map`** — jamais sur un compte hérité du catalogue.
- Comme les deux pages consomment la même liste d'applications via le même hook, les nombres coïncideront naturellement ; c'est une conséquence, pas une contrainte à câbler.

### Le titre disparaît de `/map`
- Le titre « Applications by location » et le sous-titre « No location data available yet » sont supprimés du panneau. Le panneau commence directement par son contenu.
- Le message « No location data available yet » reste là où il a du sens, **dans la carte elle-même** (`MapView`) — il n'est pas supprimé du produit, seulement du panneau de filtres.

### Le compteur « N / M applications » est conservé, à l'identique
- Le compteur affiché sous le panneau du catalogue est **gardé** et apparaît aussi sur `/map`, avec un rendu **strictement identique** : même formulation, même typographie, même position relative au panneau.
- Il fait donc partie de l'ensemble « panneau » et suit l'enveloppe partagée, plutôt que d'être recollé à la main de chaque côté.

## Requirements

### Functional Requirements
- Le panneau de filtres présente un encadrement visuellement identique sur `/` et sur `/map` : même bordure, même fond, mêmes coins, même padding.
- La rangée ACTIONS est rendue sur `/map` comme sur `/`, avec Export PDF et Show in Discover pleinement fonctionnels (export réel, modale d'avertissement, ouverture de Discover avec la sélection filtrée).
- Les compteurs par option des chapitres Category, Status, Portfolio et Business Criticality sont affichés sur `/map` comme sur `/`.
- Le titre et le sous-titre au-dessus du panneau de `/map` n'existent plus.
- Le compteur « N / M applications » est rendu à l'identique sous le panneau des deux pages.
- Le panneau mobile (`FilterSheet`) offre exactement les mêmes fonctions sur les deux pages.
- Les filtres restent partagés entre les deux pages : filtrer sur l'une filtre l'autre, comme aujourd'hui.

### Non-Functional Requirements
- **Zéro duplication** : la logique des actions n'existe qu'en un seul endroit, consommé par les deux pages. Un copier-coller dans `MapClient` est un échec de cette spec.
- L'import dynamique du moteur PDF (`@react-pdf/renderer`) reste **paresseux** : monter les actions sur `/map` ne doit pas alourdir le chargement initial de la carte.
- Le panneau de `/map` reste lisible par-dessus les tuiles MapLibre, en thème clair comme en thème sombre.
- Le panneau de `/map` conserve son positionnement flottant, sa largeur, son défilement interne et son empilement au-dessus de la carte.
- Aucun appel réseau supplémentaire ; le filtrage reste entièrement côté client.
- Respect des deux axes de thème : couleurs par les tokens `[data-theme]`, structurel seulement dans `styles/themes/*.css`.

## Scope

### In Scope
- Unification de l'encadrement du panneau entre les deux pages.
- Extraction et réutilisation de la logique des actions (export PDF + Show in Discover + modale).
- Activation des compteurs par option sur `/map`.
- Reprise du compteur « N / M applications » sur `/map`, au même rendu que sur le catalogue.
- Suppression du titre et du sous-titre du panneau de `/map`.

### Out of Scope
- Toute modification du contenu des filtres (chapitres, ordre, sémantique OU/ET, arbre Business Capabilities).
- Le rendu de la carte MapLibre, ses marqueurs et son message interne « No location data available yet ».
- L'unification du panneau avec celui de `/discover`, qui n'utilise pas `FilterBar`.
- La mise en page générale du catalogue (grille de cartes, pagination) — hors le panneau lui-même et le compteur qui le suit.
- Toute évolution de l'export PDF lui-même (contenu du document, mise en page).

## Affected Areas
- **Créer** : l'**enveloppe partagée** du panneau — cadre plein (tokens `--color-surface` / `--color-border` / `--radius-card`, padding), `FilterBar` à l'intérieur, et le compteur « N / M applications » dessous. Montée par `/` et par `/map`, jamais par `FilterSheet`.
- **Créer** : le **hook des actions** (dans `lib/`), portant l'état et les gestionnaires (export PDF, seuil Discover, écriture du jeton de seed, ouverture de l'onglet) et renvoyant `{ actions, dialog }`.
- **Modifier** : `components/MapClient.tsx` — retirer le titre et le sous-titre, remplacer le conteneur `glass-panel` par l'enveloppe partagée, appeler le hook et passer `actions` et `previewCount`.
- **Modifier** : `components/CatalogueClient.tsx` — adopter l'enveloppe partagée, et céder la logique des actions au hook qu'il consommera désormais comme `/map`.
- **Non touché** : `components/FilterBar.tsx` — il ne porte **pas** le cadre ; l'enveloppe le laisse inchangé, ce qui évite d'y ajouter une prop de désactivation pour la feuille mobile.
- **Non touché** : `components/FilterSheet.tsx` — continue de rendre `FilterBar` nu dans son propre châssis ; il reçoit simplement `actions` et `previewCount` des deux pages au lieu d'une seule.
- **À vérifier** : `styles/themes/map-first.css` — `glass-panel` n'est plus utilisée par le panneau de filtres ; décider si la règle reste utile à d'autres surfaces de la carte avant de la toucher.
- **Non touché** : `components/MapView.tsx`, `components/CatalogueActions.tsx`, `components/ConfirmDialog.tsx`, `lib/appFilters.ts`, `lib/useFilteredApplications.ts`, `lib/discoverSeed.ts`.

## Edge Cases
- **Encadrement en double dans le panneau mobile** : `FilterSheet` fournit déjà un fond et une bordure ; il doit rendre `FilterBar` nu, jamais l'enveloppe partagée.
- **Panneau `/map` encadré deux fois** : le conteneur flottant ne doit plus porter `glass-panel` ni son padding une fois l'enveloppe en place, sinon deux cadres s'imbriquent.
- **Modale non montée** : une page qui consomme le hook sans rendre son `dialog` rend « Show in Discover » silencieux au-delà du seuil — à vérifier explicitement sur les deux pages.
- **Aucune application visible** sur `/map` : Export PDF et Show in Discover doivent se désactiver exactement comme sur le catalogue, pas déclencher une action vide.
- **Export lancé depuis `/map`, puis navigation vers `/`** pendant la génération : l'état d'export ne doit pas laisser un bouton figé en « en cours ».
- **Deux panneaux montés simultanément** (colonne desktop et feuille mobile au même instant, lors d'un redimensionnement) : deux rangées ACTIONS existent dans le DOM ; elles doivent partager le même état d'export et ne pas ouvrir deux modales.
- **Contraste sur les tuiles** : un fond de panneau trop translucide rend les libellés illisibles au-dessus d'une zone claire de la carte en thème sombre (et l'inverse).
- **Modale de confirmation ouverte au-dessus de la carte** : elle doit couvrir la carte MapLibre, pas passer dessous (superposition).
- **Info-bulles des actions sur `/map`** : le panneau a un défilement interne et une hauteur maximale ; une info-bulle ancrée sous le bouton ne doit pas être tronquée par ce défilement.

## Open Questions
- **Où porter l'encadrement** : dans `FilterBar` lui-même (garantie la plus forte contre la divergence, mais il faut neutraliser le cadre en contexte `FilterSheet`), ou dans une petite enveloppe partagée utilisée par les deux pages ? => ne pas mettre le cadre dans      FilterBar, mais créer une petite  enveloppe partagée

- **Effet translucide sur le catalogue** : le catalogue adopte-t-il exactement le rendu `glass-panel` (flou + translucidité, qui n'a de sens que superposé à une carte), ou un cadre plein équivalent en géométrie mais opaque ? La formulation de la demande — « le rectangle qui encadre le filtre sur la page Map doit aussi être visible sur la page Catalogue » — parle de l'encadrement, pas nécessairement du flou. => cadre plein équivalent

- **Forme de l'unité partagée pour les actions** : hook exposant `{ actions, dialog }`, ou composant enveloppant ? Le hook garde la liberté de placement, le composant garantit qu'on n'oublie pas de monter la modale. => **hook exposant `{ actions, dialog }`** (recommandation, voir « Forme de l'unité partagée » dans les Décisions) : la rangée doit voyager dans une prop jusqu'à l'intérieur de `FilterBar` alors que la modale doit être montée une seule fois à la racine — deux nœuds séparés rendent cette asymétrie explicite, là où un composant imposerait un contexte pour deux consommateurs.

- **Compteur « N / M applications »** : le catalogue l'affiche sous le panneau, `/map` ne l'a pas. Fait-il partie de l'unification demandée, ou reste-t-il propre au catalogue ? => si garde le aussi, le visuel doit etre identique

## Acceptance Criteria
- [ ] Le panneau de filtres a le même encadrement sur `/` et sur `/map` (bordure, fond, rayon, padding), en thème clair comme en thème sombre.
- [ ] Le titre « Applications by location » et le sous-titre « No location data available yet » ne sont plus rendus au-dessus du panneau de `/map`.
- [ ] Le même message reste visible à l'intérieur de la carte, inchangé.
- [ ] La rangée ACTIONS est présente sur `/map`, avec des pastilles, des info-bulles et des compteurs identiques à ceux du catalogue.
- [ ] Un export PDF lancé depuis `/map` produit le même document que depuis le catalogue, pour la même sélection filtrée.
- [ ] « Show in Discover » depuis `/map` ouvre Discover avec exactement les applications filtrées, avertissement et transport par jeton compris.
- [ ] Les compteurs par option sont affichés sur `/map` et correspondent au résultat réel d'un clic.
- [ ] Le panneau mobile offre les mêmes fonctions sur les deux pages.
- [ ] Le cadre est un aplat plein (pas l'effet verre), identique sur les deux pages.
- [ ] Le compteur « N / M applications » est présent sur les deux pages, avec un rendu identique.
- [ ] Aucun cadre en double, ni dans la feuille mobile, ni sur le panneau flottant de la carte.
- [ ] `FilterBar` n'a pas gagné de prop servant à désactiver un encadrement.
- [ ] La logique des actions n'est écrite qu'une fois, dans le hook ; `MapClient` n'en contient aucune copie.
- [ ] La modale de confirmation est montée exactement une fois par page, même quand la colonne desktop et la feuille mobile coexistent.
- [ ] Le chargement initial de `/map` n'embarque pas le moteur PDF.
- [ ] Build Next OK, aucune régression sur le filtrage partagé, la pagination ou la carte.
