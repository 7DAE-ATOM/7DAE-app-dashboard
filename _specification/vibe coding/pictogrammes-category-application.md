# Feature Spec: Pictogrammes de Catégorie d'Application

## Summary
- Remplacer la représentation actuelle de la **catégorie d'application** — un glyphe SVG générique identique pour les six catégories (`components/icons/CategoryIcon.tsx`) suivi du libellé — par un **pictogramme dédié à chaque catégorie**, fourni sous forme d'image.
- Les six images sources sont déposées dans `temp/category/` et correspondent exactement aux six valeurs de `ApplicationCategory` :

  | Fichier source | Valeur `ApplicationCategory` | Libellé (`CATEGORY_LABELS`) |
  |---|---|---|
  | `IVBOT.png` | `ivbot` | IVBOT |
  | `End Userr Tool.png` *(faute de frappe dans le nom)* | `END_USER_TOOL` | End User Tool |
  | `Component.png` | `component` | Component |
  | `Official.png` | `official` | Official |
  | `Not 1V.png` | `not1v` | Not 1V |
  | `Not Defined.png` | `notDefined` | Not Defined |

- Surfaces concernées : la **card du catalogue** (`ApplicationCard`, variante normale **et** variante compacte à 8 colonnes) et la **vue détail** (`ApplicationHeader`). Les deux passent par le même composant `ChipCategory`, qui est donc le point de modification unique.
- Les images sources sont des PNG **1254 × 1254, RGB sans canal alpha, ~1,1 Mo pièce**. Elles doivent être **optimisées et déplacées sous `public/`** ; `temp/` est un dossier de travail et ne doit rien livrer.
- Le libellé texte de la catégorie est **conservé** à côté du pictogramme : le picto accélère le scan, le texte porte le sens et l'accessibilité.

## Motivation
- Aujourd'hui `ChipCategory` affiche le **même glyphe** pour les six catégories : l'icône n'apporte aucune information, elle ne fait qu'occuper de la place. Seul le texte distingue une application `Official` d'un `End User Tool`.
- La catégorie est l'un des deux axes de lecture rapide d'une card (avec la criticité métier). Un pictogramme propre à chaque valeur la rend identifiable **sans lire**, ce qui compte d'autant plus depuis que le catalogue peut afficher jusqu'à 8 cards par ligne — voir `densite-affichage-catalogue-colonnes-et-lignes-par-page.md`, où la card compacte réduit déjà le texte au minimum.
- Cohérence avec le reste de l'application, qui a déjà fait ce choix ailleurs : pictogrammes de programmes avion, pictogrammes ATA, pictogrammes de technical capabilities. La catégorie était la dernière dimension structurante encore purement textuelle.

## Décisions (arbitrées)
- **Emplacement des assets** : `public/categories/<slug>.<ext>`, un fichier par catégorie, nommé d'après la **valeur de l'enum** et non d'après le libellé (`END_USER_TOOL` → `end-user-tool`). Les noms de fichiers sources (espaces, faute de frappe « Userr ») ne survivent pas à l'import.
- **Mapping explicite** : un `Record<ApplicationCategory, string>` dans `lib/labels.ts` (à côté de `CATEGORY_LABELS`) associe chaque catégorie à son chemin. Aucune construction de chemin par concaténation ou par transformation du libellé — une catégorie ajoutée en amont doit provoquer une erreur de typage, pas une image 404 silencieuse.
- **Point de modification unique** : `components/ChipCategory.tsx`. La card et la vue détail l'utilisent déjà toutes les deux (`ApplicationCard.tsx`, `ApplicationHeader.tsx`), donc aucune duplication de logique n'est nécessaire.
- **Le libellé reste affiché** dans les deux surfaces.
- **Fallback** : une catégorie inconnue ou absente affiche le pictogramme `Not Defined`, jamais une image cassée.

## Requirements

### Functional Requirements

#### Préparation des assets
- Les six PNG sont redimensionnés à une taille d'affichage raisonnable (cible : côté de **128 px**, suffisant pour un rendu net jusqu'à 64 px en écran HiDPI) et recompressés.
- **Budget : ≤ 15 Ko par fichier**, contre ~1,1 Mo aujourd'hui. Avec 48 cards par page au réglage de densité maximal, des images non optimisées multiplieraient le poids de la page par un facteur à deux chiffres.
- Les fichiers optimisés sont commités sous `public/categories/`. Le dossier `temp/category/` est supprimé une fois l'import fait.
- Les images sont carrées et doivent le rester — le composant les affiche dans un conteneur carré, sans déformation.

#### Rendu du pictogramme
- `ChipCategory` affiche le pictogramme de la catégorie à la place du glyphe `CategoryIcon`, suivi du libellé.
- Tailles :
  - **card normale** (3 ou 5 colonnes) : pictogramme de ~16 px, aligné verticalement avec le texte du chip ;
  - **card compacte** (8 colonnes) : même chip, taille réduite si nécessaire pour que le chip catégorie et la pastille de criticité tiennent sur une ligne sans retour ;
  - **vue détail** (`ApplicationHeader`) : pictogramme plus généreux (~24 px), la fiche ayant la place de le mettre en valeur.
- Le pictogramme ne déforme jamais la hauteur du chip : la ligne de chips de la card doit garder exactement la hauteur qu'elle a aujourd'hui, sinon l'alignement du titre et de la ligne de statut (ancrée en bas de card) bouge.
- Les images sont chargées en `loading="lazy"` comme les couvertures de card, et servies depuis `public/` (pas de dépendance réseau externe).

#### Intégration des deux thèmes
- Les images sources ont un **fond blanc opaque** (RGB, sans transparence). Rendues telles quelles en mode sombre, elles produisent six carrés blancs lumineux dans la grille.
- Le rendu retenu doit être **visuellement correct en mode clair et en mode sombre**, sans version alternative de chaque image par thème (la convention du projet — voir le logo Airbus unique dans CLAUDE.md — est un asset unique qui s'adapte).
- L'option de mise en œuvre est tranchée dans les Open Questions ci-dessous.

#### Comportement de repli
- Catégorie absente, inconnue ou non mappée → pictogramme `Not Defined` + libellé correspondant.
- Image indisponible (404, cache vide, réseau coupé) → le chip reste lisible : le libellé texte s'affiche sans laisser de trou ni d'icône cassée.

### Non-Functional Requirements
- **Aucune nouvelle dépendance npm.** L'optimisation des images est un acte ponctuel de préparation, pas une étape de build.
- **Aucun appel réseau tiers** : les pictogrammes sont des assets locaux, conformément à la règle du projet qui interdit d'aller chercher des visuels chez un service externe.
- **Poids de page** : au réglage de densité maximal (8 colonnes × 6 lignes = 48 cards), le surcoût total apporté par les pictogrammes doit rester négligeable — les six images étant partagées par toutes les cards, le navigateur n'en télécharge que six, une seule fois.
- **Accessibilité** : le pictogramme est décoratif (`alt=""` / `aria-hidden`), le libellé texte reste le porteur de l'information. Aucune information n'est véhiculée par la seule image.
- **Thèmes** : rendu correct en clair et en sombre sans règle CSS par catégorie.

## Scope

### In Scope
- Import, optimisation et commit des six pictogrammes sous `public/categories/`.
- Table de correspondance `ApplicationCategory` → chemin d'image dans `lib/labels.ts`.
- Modification de `components/ChipCategory.tsx` : pictogramme par catégorie, taille paramétrable, repli.
- Ajustement de l'appel dans `components/ApplicationHeader.tsx` (vue détail) pour la taille plus grande.
- Vérification du rendu dans `components/ApplicationCard.tsx` en mode normal **et** compact.
- Suppression de `temp/category/` et, s'il devient orphelin, de `components/icons/CategoryIcon.tsx`.

### Out of Scope
- Le **filtre par catégorie** (`components/FilterBar.tsx`) : la liste des options reste textuelle en V1.
- La carte d'identité **Discover** (`components/discover/ApplicationInfoCard.tsx`), qui affiche la catégorie en texte simple.
- L'**export PDF** (`components/pdf/ApplicationDetailPage.tsx`, `components/pdf/icons.tsx`) : il possède son propre jeu de glyphes vectoriels et continue d'utiliser `PdfCategoryIcon`.
- Toute autre dimension (criticité métier, statut, portfolio) : leur représentation actuelle est inchangée.
- Rendre les pictogrammes cliquables ou filtrants.
- Générer des variantes par thème, par densité ou par langue.

## Affected Areas
- **Créer** : `public/categories/` et ses six images optimisées.
- **Modifier** :
  - `lib/labels.ts` — table `ApplicationCategory` → chemin du pictogramme, à côté de `CATEGORY_LABELS`.
  - `components/ChipCategory.tsx` — rendu du pictogramme, taille, repli.
  - `components/ApplicationHeader.tsx` — taille de pictogramme propre à la fiche.
- **Supprimer** : `temp/category/` ; `components/icons/CategoryIcon.tsx` s'il n'a plus aucun appelant.
- **Non touché** : `components/ApplicationCard.tsx` (il consomme `ChipCategory` sans le paramétrer au-delà de ce qui existe), `FilterBar`, `ApplicationInfoCard`, les composants PDF, `lib/filterDescription.ts`, `lib/types.ts` (l'enum ne bouge pas), la couche API et l'adapter.

## Edge Cases
- **Catégorie inconnue** renvoyée par le backend (nouvelle valeur ajoutée en amont) : repli sur `Not Defined`, aucune image cassée.
- **Image manquante ou 404** : le chip reste lisible avec son seul libellé.
- **Mode sombre** : aucun carré blanc lumineux dans la grille — c'est le principal risque visuel de cette évolution.
- **Card compacte à 8 colonnes** : le chip catégorie et la pastille de criticité doivent tenir sur une ligne ; sinon le pictogramme est réduit, pas le libellé tronqué au point d'être illisible.
- **Libellé long** (`End User Tool`) dans une card compacte : le chip ne doit pas déborder de la card ni pousser la criticité hors cadre.
- **Écran HiDPI** : le pictogramme reste net à 16 px comme à 24 px — d'où la source à 128 px plutôt qu'à la taille d'affichage exacte.
- **Impression / export PDF depuis le navigateur** : le pictogramme doit rester visible sur fond blanc (les couleurs des images sont sombres, donc a priori sans problème).
- **Chargement froid** : avant l'arrivée des images, la ligne de chips ne doit pas changer de hauteur, sinon toute la card tressaute.

## Open Questions
- **Fond blanc opaque des sources** : faut-il (a) détourer les images pour obtenir un fond transparent, (b) les afficher dans une tuile blanche arrondie assumée, comme un badge de marque, ou (c) les convertir en SVG ? Recommandation : **(a) détourage en PNG/WebP transparent** — le picto s'intègre alors aux deux thèmes sans artifice, et le coût est ponctuel. **(b)** est le repli acceptable si le détourage dégrade le visuel. **(c)** est hors budget pour six illustrations en dégradé. => suivre recommendation

- **Format cible** : WebP (plus léger) ou PNG (plus universel) ? Recommandation : **WebP**, universellement supporté par les navigateurs cibles, avec le budget de 15 Ko facilement tenu. => suivre recommendation

- **Card compacte à 8 colonnes** : garder pictogramme + libellé, ou basculer sur le **pictogramme seul** (le sens restant accessible via l'attribut `title`) pour libérer de la largeur ? Recommandation : **pictogramme seul en compact**, c'est exactement le gain que ces images rendent possible — mais à confirmer visuellement. => suivre recommendation

- **Extension au filtre et à Discover** : les mettre au même niveau tout de suite, ou traiter ensuite ? Recommandation : **ensuite**, en itération séparée, une fois le rendu des pictogrammes validé sur la card et la fiche.
=> suivre recommendation

- **Export PDF** : y porter les pictogrammes raster, ou conserver le glyphe vectoriel actuel ? Recommandation : **conserver le vectoriel** — six images raster dans un export multi-pages alourdissent le fichier pour un gain faible en impression. => suivre recommendation

## Acceptance Criteria
- [ ] Les six catégories affichent **chacune un pictogramme distinct**, sur la card du catalogue comme sur la vue détail.
- [ ] Les pictogrammes sont servis depuis `public/categories/`, chaque fichier pesant **≤ 15 Ko**.
- [ ] `temp/category/` n'existe plus dans le dépôt.
- [ ] La correspondance catégorie → image est exhaustive et vérifiée par le typage : ajouter une valeur à `ApplicationCategory` sans son image ne compile pas.
- [ ] Le libellé texte reste affiché sur la card (hors éventuel mode compact, selon l'arbitrage) et sur la fiche.
- [ ] Le rendu est correct en **mode clair et en mode sombre** : aucun carré blanc en thème sombre.
- [ ] La ligne de chips garde sa hauteur actuelle : le titre et la ligne statut/complétion (ancrée en bas de card) ne se déplacent pas.
- [ ] En card compacte (8 colonnes), catégorie et criticité tiennent sur une seule ligne, sans débordement.
- [ ] Une catégorie inconnue affiche le pictogramme `Not Defined` ; une image indisponible laisse un chip toujours lisible.
- [ ] Le pictogramme est décoratif pour les lecteurs d'écran ; l'information reste portée par le texte.
- [ ] Aucune nouvelle dépendance npm, aucun appel réseau vers un service tiers.
- [ ] Aucune régression sur le filtre par catégorie, sur Discover et sur l'export PDF, qui restent dans leur forme actuelle.
