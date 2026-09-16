# Feature Spec: Pictogrammes de Business Criticality

## Summary
- Remplacer le **chip texte coloré** de la criticité métier (`components/ChipBusinessCriticality.tsx` : pastille `Mission Critical`, `Business Critical`, …) par un **pictogramme dédié à chaque niveau**, sur le même modèle que les pictogrammes de catégorie livrés juste avant (`pictogrammes-category-application.md`).
- Les images sources sont déposées dans `temp/criticality/` et couvrent les cinq valeurs de `BusinessCriticality` :

  | Fichier source | Valeur `BusinessCriticality` | Libellé (`BUSINESS_CRITICALITY_LABELS`) |
  |---|---|---|
  | `Mission Critical.png` | `missionCritical` | Mission Critical |
  | `Business Critical.png` | `businessCritical` | Business Critical |
  | `Business Operational.png` | `businessOperational` | Business Operational |
  | `Administrative.png` | `administrativeService` | Administrative Service |
  | `Not Set.png` | `NA` | Not set |

- Les cinq visuels forment une **jauge** : un même bouclier bleu portant quatre barres, dont *n* sont allumées selon le niveau (Mission Critical = 4 allumées, Business Operational = 2, …). Ce n'est donc pas un jeu de symboles distincts mais une échelle graduée.
- Surfaces concernées : la **card du catalogue** (`ApplicationCard`, variantes normale et compacte) et la **vue détail** (`ApplicationHeader`). Ce sont les deux seuls appelants du composant.
- Les sources sont des PNG **1254 × 1254, RGB sans canal alpha, ~0,8 à 1,1 Mo pièce** : même préparation que pour les catégories (détourage du fond blanc, réduction, WebP transparent, dépôt sous `public/`).

## Motivation
- Le chip texte occupe une largeur importante sur la card — « Business Operational » est long — juste à côté du pictogramme de catégorie, qui vient lui de passer en image seule. La ligne de chips est aujourd'hui visuellement déséquilibrée : une icône soignée d'un côté, un pavé de texte de l'autre.
- Cette asymétrie coûte particulièrement cher en grille dense : à 8 cards par ligne, le libellé de criticité est ce qui reste de plus encombrant sur la card compacte.
- Une jauge se lit d'un coup d'œil et se **compare** entre cards, ce qu'un libellé texte ne permet pas : sur une grille de 30 applications, repérer les plus critiques devient immédiat.
- Cohérence : après les programmes avion, les ATA, les technical capabilities et la catégorie, la criticité est la dernière dimension de la card encore purement textuelle.

## Décisions (arbitrées)
- **Même pipeline d'assets que les catégories** : détourage du fond blanc **par diffusion depuis les bords** (et non par seuil global, qui percerait les parties claires du visuel), réduction à 128 px de côté, encodage WebP transparent, dépôt dans `public/criticality/`. Le script de préparation utilisé pour `public/categories/` est réutilisable tel quel.
- **Nommage par valeur d'enum**, pas par libellé : `mission-critical.webp`, `business-critical.webp`, `business-operational.webp`, `administrative-service.webp` (les noms sources comportent des espaces et ne correspondent pas exactement aux libellés — `Administrative.png` ↔ `Administrative Service`).
- **Mapping explicite** : un `Record<BusinessCriticality, string>` dans `lib/labels.ts`, à côté de `BUSINESS_CRITICALITY_LABELS` et de `CATEGORY_ICONS`. Un niveau ajouté en amont doit casser la compilation, pas produire un 404 silencieux.
- **Point de modification unique** : `components/ChipBusinessCriticality.tsx`.
- **Le libellé n'est plus affiché** : il reste porté par `alt` et `title` (infobulle au survol, lecteurs d'écran). C'est d'autant plus important ici que les niveaux ne se distinguent que par un nombre de barres.
- **Budget : ≤ 15 Ko par fichier.** Les pictogrammes de catégorie tiennent entre 3,2 et 4,4 Ko avec le même pipeline.
- **Les couleurs sémantiques actuelles disparaissent.** Le chip encode aujourd'hui le niveau par la couleur (`bg-danger` pour Mission Critical, `bg-warning` pour Business Critical, `bg-accent` pour Business Operational, neutre pour les autres) ; les cinq visuels sont tous bleus. L'information passe donc intégralement du canal couleur au canal « nombre de barres allumées ».

## Requirements

### Functional Requirements

#### Préparation des assets
- Les cinq PNG sont détourés, réduits à 128 px de côté et encodés en WebP transparent sous `public/criticality/`.
- Contrôle après conversion : chaque fichier ≤ 15 Ko, aucun halo blanc résiduel, aucune partie claire du bouclier percée par le détourage (les barres allumées sont très claires — c'est exactement le cas que le remplissage par diffusion doit protéger).
- Le dossier `temp/criticality/` est supprimé une fois la conversion validée.

#### Rendu du pictogramme
- `ChipBusinessCriticality` rend le pictogramme du niveau à la place du chip texte, avec une taille paramétrable.
- Le pictogramme s'aligne visuellement avec celui de la catégorie sur la même ligne de chips : même taille de référence, même alignement vertical, pas de décalage de ligne de base.
- Le libellé du niveau est disponible en `title` (survol) et en `alt`.
- Les images sont chargées en `loading="lazy"` et servies depuis `public/`.

#### Lisibilité de la jauge
- Les cinq visuels ne diffèrent que par le **nombre de barres allumées sur quatre**. Ces barres occupent environ un huitième de la hauteur de l'image chacune : rendues à 20 px, elles font 2 à 3 px de haut, et distinguer 2 barres de 3 devient incertain.
- La taille d'affichage retenue doit permettre de **distinguer sans hésitation deux niveaux voisins** (Business Critical à 3 barres vs Business Operational à 2) dans les trois contextes : card normale, card compacte, fiche détail.
- Cette contrainte prime sur l'encombrement : si une taille suffisante ne tient pas sur la card compacte, c'est cette variante qui doit être arbitrée (voir Open Questions), pas la lisibilité qui doit être sacrifiée.

#### Niveau non défini (`NA`)
- Le comportement actuel — **ne rien afficher** quand la criticité vaut `NA` — vient d'une demande explicite : « Not set » n'était que du bruit.
- Une image `Not Set.png` est pourtant fournie. Son sort est tranché dans les Open Questions.

#### Comportement de repli
- Niveau inconnu ou non mappé → aucun rendu plutôt qu'une image cassée.
- Image indisponible (404, cache vide) → repli sur le chip texte actuel, pour que le niveau reste lisible.

### Non-Functional Requirements
- **Aucune nouvelle dépendance npm** : la préparation des images est un acte ponctuel, hors build, avec l'outillage déjà présent dans `node_modules`.
- **Aucun appel réseau tiers** : assets locaux uniquement.
- **Poids de page** : cinq images partagées par toutes les cards, téléchargées une fois — surcoût négligeable, même à 48 cards par page.
- **Accessibilité** : le libellé reste accessible via `alt`/`title`. Point d'attention renforcé par rapport aux catégories — l'information étant portée par un décompte de petites barres, la version textuelle n'est pas un confort mais un recours.
- **Thèmes** : rendu correct en clair comme en sombre, sans version alternative par thème.

## Scope

### In Scope
- Import, détourage, optimisation et commit des pictogrammes sous `public/criticality/`.
- Table `BusinessCriticality` → chemin d'image dans `lib/labels.ts`.
- Réécriture de `components/ChipBusinessCriticality.tsx` : pictogramme, taille paramétrable, repli, conservation du masquage de `NA`.
- Ajustement des tailles aux deux points d'appel : `components/ApplicationCard.tsx` (normal et compact) et `components/ApplicationHeader.tsx`.
- Suppression de la table `COLORS` du composant, devenue sans objet.
- Suppression de `temp/criticality/`.

### Out of Scope
- Le **filtre par criticité** (`components/FilterBar.tsx`) et la description de filtre (`lib/filterDescription.ts`) : ils restent textuels, « Not set » y demeurant un critère de sélection légitime.
- L'**export PDF** (`components/pdf/`), qui conserve son rendu actuel.
- La carte d'identité **Discover**.
- Toute modification de l'enum `BusinessCriticality` ou de `BUSINESS_CRITICALITY_LABELS`, qui restent la source des libellés.
- Rendre le pictogramme cliquable ou filtrant.
- Une légende expliquant l'échelle des barres.

## Affected Areas
- **Créer** : `public/criticality/` et ses images optimisées.
- **Modifier** :
  - `lib/labels.ts` — table `BusinessCriticality` → chemin du pictogramme.
  - `components/ChipBusinessCriticality.tsx` — rendu image, taille, repli, masquage de `NA` conservé.
  - `components/ApplicationCard.tsx` et `components/ApplicationHeader.tsx` — tailles d'appel.
- **Supprimer** : `temp/criticality/`.
- **Non touché** : `components/FilterBar.tsx`, `lib/filterDescription.ts`, `components/pdf/*`, `components/discover/*`, `lib/types.ts`, la couche API et l'adapter.

## Edge Cases
- **Criticité `NA`** : rien n'est rendu ; le pictogramme de catégorie reste seul sur sa ligne, alignée à gauche, sans changement de hauteur de ligne.
- **Niveau inconnu** renvoyé par le backend : aucun rendu, aucune image cassée.
- **Image manquante ou 404** : repli sur le chip texte d'origine.
- **Card compacte à 8 colonnes** : le pictogramme de catégorie et celui de criticité doivent tenir sur une ligne, à une taille où la jauge reste déchiffrable.
- **Deux niveaux voisins côte à côte** dans la grille : la différence d'une barre doit rester perceptible sans zoom.
- **Mode sombre** : le bouclier est bleu vif sur fond transparent — à vérifier qu'il ne vibre pas sur le fond sombre, et que les barres éteintes restent distinctes des barres allumées.
- **Écran HiDPI** : source à 128 px pour rester net à toutes les tailles d'affichage envisagées.
- **Chargement froid** : la ligne de chips ne doit pas changer de hauteur à l'arrivée des images.

## Open Questions
- **Image `Not Set`** : l'importer et l'afficher (revenant sur la décision récente de ne rien afficher pour `NA`), ou ne pas l'importer du tout ? Recommandation : **ne pas l'importer** — le masquage de `NA` a été demandé explicitement, et un bouclier à zéro barre reste du bruit visuel pour une information absente. => oui ne rien afficher finalement

- **Taille d'affichage** : la jauge est nettement moins lisible qu'un pictogramme de catégorie à taille égale. Faut-il l'afficher **plus grande** que la catégorie (par exemple 1,5 × sa taille), ou aligner les deux et accepter la perte de finesse ? Recommandation : **plus grande que la catégorie**, quitte à déséquilibrer la ligne — une jauge illisible ne vaut rien. => suivre recommendation, mais agrandir la catégorie également pour avoir la même taille

- **Card compacte** : garder la jauge, ou revenir au chip texte dans cette seule variante où la place manque ? Recommandation : **garder la jauge**, en validant visuellement qu'elle reste déchiffrable à la taille disponible ; sinon, la masquer complètement plutôt que d'afficher une jauge indécodable.  => suivre recommendation

- **Perte du codage couleur** : les cinq visuels sont bleus, alors que le chip actuel signalait Mission Critical en rouge et Business Critical en orange. Faut-il compenser (halo ou fond teinté derrière le pictogramme selon le niveau), ou accepter que l'échelle passe uniquement par le nombre de barres ? Recommandation : **accepter**, pour ne pas surcharger un visuel déjà travaillé — à réévaluer si la lecture en grille s'avère difficile.  => suivre recommendation

- **Ordre des niveaux** : confirmer la correspondance barres ↔ niveaux sur les cinq images (4 = Mission Critical, 3 = Business Critical, 2 = Business Operational, 1 = Administrative Service, 0 = Not Set) avant de figer le mapping. Recommandation : **vérification visuelle des cinq sorties** au moment de la conversion.  => c'est bon

## Acceptance Criteria
- [ ] Les niveaux de criticité s'affichent sous forme de pictogramme, sans libellé texte, sur la card du catalogue et sur la fiche détail.
- [ ] Les pictogrammes sont servis depuis `public/criticality/`, chaque fichier pesant **≤ 15 Ko**.
- [ ] La correspondance niveau → image est exhaustive et vérifiée par le typage.
- [ ] La correspondance entre nombre de barres allumées et niveau est conforme à l'ordre de l'échelle, vérifiée visuellement.
- [ ] Deux niveaux voisins sont **distinguables sans hésitation** à la taille d'affichage retenue, sur la card normale comme sur la fiche.
- [ ] Une criticité `NA` n'affiche toujours rien.
- [ ] Le libellé du niveau reste accessible au survol et aux lecteurs d'écran.
- [ ] Une image indisponible fait retomber sur le chip texte : le niveau ne devient jamais invisible par accident.
- [ ] Le rendu est correct en mode clair et en mode sombre.
- [ ] La ligne de chips de la card garde une hauteur stable ; le titre et la ligne statut ancrée en bas ne se déplacent pas au chargement.
- [ ] `temp/criticality/` n'existe plus dans le dépôt, et la table `COLORS` du composant a disparu.
- [ ] Aucune nouvelle dépendance npm, aucun appel réseau tiers, aucune régression sur le filtre par criticité, sur Discover et sur l'export PDF.
