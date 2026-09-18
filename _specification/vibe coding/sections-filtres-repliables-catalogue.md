# Feature Spec: Sections de Filtres Repliables au Catalogue

## Summary
- Introduire un **titre de premier niveau « FILTERING »** au-dessus du champ de recherche, **pendant exact du titre « ACTIONS »** déjà présent. Le panneau se lit dès lors comme deux blocs : **ACTIONS** (Export PDF / Show in Discover) puis **FILTERING** (tout le reste).
- Sous **FILTERING**, le champ de recherche global reste en tête, puis les axes deviennent des **sous-chapitres** : Photo, Category, Status, Portfolio, Operator, Business Criticality, Business Capabilities. La hiérarchie visuelle passe par la **taille de police** — titres de premier niveau (ACTIONS, FILTERING) plus grands, libellés de sous-chapitre plus petits — et par l'**encadrement** : chaque sous-chapitre est une **carte à coins arrondis** (fond `surface`, fine bordure, padding interne), sur toute la largeur du panneau.
- Rendre **repliables par sous-chapitre** ces sections du panneau de filtres du Catalogue (`components/FilterBar.tsx`).
- Chaque en-tête de sous-chapitre devient **cliquable** et porte un **triangle (chevron) à droite**, après le libellé et le compteur, qui pointe vers le haut quand le sous-chapitre est déplié et vers le bas quand il est replié.
- Les **pills de filtre** adoptent la même forme : plus hautes, à coins arrondis, sur un fond légèrement contrasté par rapport à celui de leur carte.
- Replié, un sous-chapitre n'affiche plus que sa ligne d'en-tête ; son contenu (pills, champ, arbre) disparaît, mais **les valeurs sélectionnées restent actives** — replier est un geste d'affichage, jamais une remise à zéro.
- Pour qu'un sous-chapitre replié ne cache pas une sélection en cours, son en-tête affiche un **compteur de filtres actifs** à droite lorsqu'il en porte.
- Le panneau étant partagé, le comportement vaut **à l'identique en desktop (colonne de gauche du Catalogue), en mobile (`FilterSheet`) et sur `/map`**.

## Motivation
- Le panneau de filtres a beaucoup grossi : au fil des ajouts (Portfolio, Business Criticality, puis l'arbre Business Capabilities) il empile aujourd'hui sept chapitres plus une barre de recherche et une rangée d'actions, tous dépliés en permanence.
- Conséquence directe : les chapitres du bas — dont l'arbre Business Capabilities, le plus haut de tous — ne sont atteignables qu'après un long défilement, et l'utilisateur perd de vue les filtres déjà posés en haut du panneau.
- Sur mobile la sheet est bornée à `85vh` avec scroll interne : l'empilement complet y est encore plus pénalisant.
- Replier les chapitres inutilisés est le moyen le plus simple de rendre le panneau parcourable d'un coup d'œil, sans supprimer aucun axe ni imposer une réorganisation du filtre.
- Le triangle est le signal attendu : l'utilisateur le connaît déjà dans ce même panneau, l'arbre Business Capabilities l'utilisant sur chacun de ses nœuds. Il est ici placé **à droite** de l'en-tête, comme sur la maquette `temp/filter.jpg` — l'arbre, lui, garde ses chevrons à gauche puisqu'ils y portent l'indentation de la hiérarchie.
- La rangée **ACTIONS** est aujourd'hui le **seul** bloc du panneau à porter un titre, et tout ce qui la suit — champ de recherche compris — flotte sans en-tête commun. L'ensemble se lit donc comme une liste plate où « ACTIONS » paraît être un chapitre parmi les autres, alors que c'est le seul qui ne filtre rien. Poser **FILTERING** en regard rétablit la symétrie : deux blocs de même rang, et sept axes clairement subordonnés au second.
- Cette mise en hiérarchie est le complément naturel du repli : une fois tous les sous-chapitres repliés, le panneau se lit comme une table des matières à deux niveaux, ce qui n'a de sens que si les deux niveaux se distinguent à l'œil — d'où l'ajustement des tailles de police.

## Décisions (arbitrées)
- **Deux niveaux de titre, et deux seulement** :
  - **Niveau 1** — les blocs : **ACTIONS** (existant, inchangé dans son contenu) et **FILTERING** (nouveau).
  - **Niveau 2** — les sous-chapitres de FILTERING : Photo, Category, Status, Portfolio, Operator, Business Criticality, Business Capabilities.
- **Position de FILTERING** : juste **au-dessus du champ de recherche global**, qui devient le premier élément du bloc. L'ordre du panneau est donc : ACTIONS (si fourni) → FILTERING → recherche → les sept sous-chapitres, dans leur ordre actuel.
- **Titres de niveau 1 non repliables** : ni ACTIONS ni FILTERING ne portent de triangle et ne se replient. Ce sont des étiquettes de structure, pas des volets. Seuls les sept sous-chapitres se replient.
- **Typographie** : les deux niveaux gardent la même famille, la même graisse et la même casse (majuscules, interlettrage large) que l'en-tête ACTIONS actuel ; seule la **taille** les distingue — **niveau 1 plus grand que niveau 2**, le niveau 2 reprenant la taille des libellés de chapitre actuels. Aucun trait de séparation ni couleur différenciante : la taille, l'encadrement et l'espacement suffisent.
- **Couleur** : les deux niveaux restent en `text-muted`. Le niveau 1 peut se distinguer par sa seule taille ; s'il faut davantage de poids, on l'obtient par la graisse, jamais par une couleur codée en dur.
- **Carte par sous-chapitre** : chaque sous-chapitre est encadré — coins arrondis au **rayon de carte déjà utilisé partout dans l'application** (fiches, chips, panneaux flottants), fond `surface`, fine bordure `border`, padding interne. Pas de nouveau rayon, pas d'ombre portée.
- **Pas d'indentation** : les cartes occupent toute la largeur du panneau. L'encadrement et la taille du titre de bloc portent la subordination à FILTERING ; un décalage supplémentaire n'apporterait rien et mangerait la largeur des pills.
- **Pills** : plus hautes et plus arrondies que les rectangles serrés d'origine, fond légèrement contrasté avec celui de leur carte à l'état inactif, fond accent à l'état sélectionné (inchangé). Même traitement pour les champs de saisie du panneau, pour qu'aucun élément ne garde l'ancien rayon.
- **Espacement** : l'écart vertical avant un titre de niveau 1 est plus grand que celui qui sépare deux sous-chapitres, pour que les deux blocs se détachent.
- **Le champ de recherche n'est pas un sous-chapitre** : il reste sans en-tête, sans triangle et **hors carte**, directement sous FILTERING, toujours visible — c'est le point d'entrée principal du filtrage.
- **FILTERING est toujours affiché**, y compris quand la rangée ACTIONS est absente (cas de `/map`) et quand la section Business Capabilities n'a pas chargé.
- **Sous-chapitres concernés par le repli** : les sept sections à en-tête — Photo, Category, Status, Portfolio, Operator, Business Criticality, Business Capabilities.
- **Non repliables** : le champ de recherche global, la rangée **ACTIONS** (Export PDF / Show in Discover, qui doit rester à un clic) et les deux titres de niveau 1 eux-mêmes.
- ~~**État par défaut** : **tous les sous-chapitres dépliés** à la première ouverture. On ne change pas ce que voit un utilisateur qui arrive pour la première fois ; le repli est une action délibérée de sa part.~~ **Remplacé** par `filtres-replies-par-defaut-etat-memorise-localement.md` : tous les sous-chapitres sont **repliés** à la première visite, et l'état est ensuite mémorisé localement.
- **Aucune exclusivité** : plusieurs chapitres peuvent être repliés ou dépliés simultanément, indépendamment les uns des autres. Ce n'est **pas** un accordéon à un seul volet ouvert.
- **Triangle à droite** : un chevron placé **en fin de ligne**, après le libellé et le compteur, pointant vers le haut quand le chapitre est déplié et vers le bas quand il est replié. Réutilisation de `components/icons/ChevronIcon.tsx` par rotation, comme le fait déjà l'arbre des capabilities — pas de seconde icône ni de nouvel asset.
- **Zone cliquable** : toute la ligne d'en-tête (libellé + compteur + triangle), pas seulement le triangle.
- **Compteur d'actifs sur l'en-tête** : à droite du libellé, un badge discret indique le nombre de valeurs actives du chapitre lorsqu'il y en a au moins une, et **reste visible chapitre replié comme déplié**. Sans quoi un chapitre replié pourrait filtrer le catalogue à l'insu de l'utilisateur. Décompte par chapitre : nombre de pills sélectionnées (Category, Status, Portfolio, Business Criticality), nombre de capabilities cochées (Business Capabilities), `1` si le champ Operator est renseigné, `1` si Photo n'est pas sur `All`.
- **Replier ne modifie jamais les valeurs** : `FilterValue` est inchangé par cette feature. Le repli n'ajoute aucun champ à la valeur de filtre et n'entre ni dans la sérialisation des filtres de l'export PDF, ni dans l'URL, ni dans la persistance des filtres existante.
- ~~**Portée de l'état** : l'ouverture/fermeture est un état **local au panneau**, non persisté entre deux visites — même règle que l'état déplié/replié de l'arbre Business Capabilities.~~ **Remplacé** par `filtres-replies-par-defaut-etat-memorise-localement.md` : l'état est persisté localement et partagé par les trois panneaux.
- ~~**Réinitialisation des filtres** : le bouton « Catalogue » du menu, qui remet déjà les filtres à zéro et réinitialise l'arbre des capabilities, **redéploie également tous les chapitres**. On repart d'un panneau entièrement ouvert, cohérent avec le premier affichage.~~ **Remplacé** par `filtres-replies-par-defaut-etat-memorise-localement.md` : la réinitialisation vide les valeurs mais **conserve** l'état de repli mémorisé.
- **Un chapitre absent reste absent** : la section Business Capabilities n'apparaît que si son arbre a chargé ; repliable ou non, cela ne change rien à cette condition.
- **Arbre imbriqué** : replier le chapitre « Business Capabilities » masque l'arbre sans toucher à l'état déplié/replié **interne** de ses nœuds — rouvrir le chapitre le retrouve tel quel.
- **Comportement identique sur `/map`** : `MapClient` rend le même `FilterBar` (sans l'axe capabilities ni la rangée d'actions) ; ses chapitres deviennent repliables sans travail dédié.
- **Comportement identique en mobile** : `FilterSheet` rend déjà `FilterBar` ; le repli y arrive automatiquement et allège directement la sheet.
- **Pas d'animation lourde** : au plus une transition courte sur la rotation du chevron. Aucune animation de hauteur du contenu, qui serait coûteuse sur l'arbre des capabilities et sans valeur ajoutée.

## Requirements

### Functional Requirements
- Un titre « FILTERING » est affiché au-dessus du champ de recherche global, au même rang visuel que le titre « ACTIONS ».
- Le champ de recherche et les sept axes de filtrage sont présentés comme subordonnés à « FILTERING » : libellés d'axe en police plus petite que « FILTERING » et « ACTIONS », et chaque axe encadré dans sa propre carte à coins arrondis.
- Les pills de filtre et les champs de saisie du panneau sont à coins arrondis, plus hauts que les rectangles d'origine.
- « FILTERING » est affiché même lorsque la rangée ACTIONS est absente, et même si la section Business Capabilities n'est pas disponible.
- Ni « FILTERING » ni « ACTIONS » ne portent de triangle ni ne se replient.
- Chacun des sept sous-chapitres du panneau de filtres expose un triangle à droite de son en-tête.
- Cliquer sur la ligne d'en-tête d'un chapitre bascule son état déplié/replié.
- Le triangle traduit visuellement l'état : pointe vers le bas replié, vers le haut déplié.
- Une carte repliée se réduit à sa seule ligne d'en-tête, sans blanc résiduel sous le titre.
- Replier un chapitre masque son contenu et conserve intégralement les valeurs qu'il porte ; le catalogue affiché ne change pas.
- Déplier un chapitre restitue son contenu avec les mêmes sélections.
- Les chapitres se replient et se déplient indépendamment les uns des autres.
- Un chapitre portant au moins une valeur active affiche un compteur sur son en-tête, visible même replié.
- À la première ouverture du panneau, tous les chapitres sont dépliés.
- Le champ de recherche global et la rangée ACTIONS ne sont pas repliables et restent toujours visibles.
- La réinitialisation des filtres redéploie tous les chapitres.
- Le comportement est identique sur le Catalogue en desktop, dans la sheet mobile et sur `/map`.

### Non-Functional Requirements
- **Aucune dépendance npm nouvelle**, aucun nouvel asset d'icône.
- **Thème** : couleurs exclusivement issues des tokens `--color-*` existants ; lisible en clair comme en sombre.
- **Cohérence visuelle** : les libellés de sous-chapitre conservent leur style actuel (majuscules, `text-muted`, même graisse et même casse). Les cartes reprennent le rayon, la bordure et le fond des cartes déjà utilisées ailleurs dans l'application — aucun rayon ni couleur en dur, aucun style de carte spécifique au panneau.
- **Hiérarchie lisible sans couleur** : la distinction niveau 1 / niveau 2 repose sur la taille, la graisse et l'espacement, jamais sur une couleur codée en dur — elle doit donc tenir à l'identique en thème clair et en thème sombre.
- **Titres ACTIONS et FILTERING strictement symétriques** : même taille, même graisse, même casse, même espacement au-dessus. Aucun des deux ne doit paraître subordonné à l'autre.
- **Pas d'élargissement du panneau** : le padding interne des cartes ne doit pas réduire la largeur utile des pills au point d'en forcer le passage à la ligne, ni faire déborder le panneau sur mobile.
- **Lisibilité des cartes sur tous les fonds** : le panneau est rendu sur le fond de page du Catalogue, dans le panneau translucide de `/map` et dans la sheet mobile, dont le fond est le même que celui des cartes — la bordure doit suffire à les délimiter dans ce dernier cas.
- **Pas de reflow au montage** : le panneau ne doit pas s'afficher déplié puis se replier sous les yeux de l'utilisateur.
- **Pas de régression de performance** : basculer un chapitre ne doit pas provoquer de recalcul du filtrage ni du catalogue.

### Accessibility Requirements
- La hiérarchie à deux niveaux est portée par la structure du document, pas seulement par la taille de police : un lecteur d'écran doit percevoir les sept axes comme subordonnés au bloc « FILTERING ».
- Les titres de bloc ne sont pas des contrôles : ils ne reçoivent pas le focus et ne sont pas annoncés comme cliquables.
- Chaque en-tête de sous-chapitre est un contrôle atteignable et actionnable au clavier.
- L'état déplié/replié est exposé sémantiquement, pas seulement par la rotation du triangle.
- Le libellé du contrôle reste le nom du chapitre ; le compteur est lisible par un lecteur d'écran en association avec ce libellé.
- Le triangle est décoratif et n'est pas annoncé séparément.

## Scope

### In Scope
- Nouveau titre de bloc « FILTERING » au-dessus du champ de recherche, symétrique de « ACTIONS ».
- Mise en hiérarchie à deux niveaux du panneau : ajustement des tailles de police et des espacements verticaux.
- Habillage en cartes à coins arrondis, une par sous-chapitre, et mise au même rayon des pills et des champs de saisie du panneau.
- En-têtes de sous-chapitre cliquables avec triangle à droite dans `FilterBar`.
- État déplié/replié local, un par chapitre, indépendants.
- Compteur de valeurs actives par chapitre sur l'en-tête.
- Redéploiement de tous les chapitres à la réinitialisation des filtres.
- Propagation automatique du comportement à la sheet mobile et à `/map`.

### Out of Scope
- Persistance de l'état déplié/replié entre deux visites ou entre deux pages.
- Mémorisation de cet état dans l'URL, dans `FilterValue` ou dans la persistance des filtres existante.
- Bouton « tout replier / tout déplier ».
- Réorganisation, renommage ou réordonnancement des sous-chapitres, et regroupement d'axes sous un troisième niveau.
- Ajout ou suppression d'un axe de filtrage.
- Repli du champ de recherche global, de la rangée ACTIONS ou des titres de niveau 1 eux-mêmes.
- Renommage du titre « ACTIONS » ou modification de son contenu.
- Refonte typographique du reste de l'application : l'ajustement des tailles et des rayons est circonscrit au panneau de filtres.
- Icône loupe dans le champ de recherche (présente sur la maquette) : elle demanderait un nouveau composant d'icône, sans rapport avec l'habillage en cartes.
- Ombre portée sur les cartes, nouveau rayon dédié, ou style de carte propre au panneau.
- Animation de hauteur du contenu des chapitres.
- Toute modification de la logique de filtrage, de la pagination ou de l'export PDF.

## Affected Areas
- **Modifier** : `components/FilterBar.tsx` — deux styles d'en-tête (titre de bloc niveau 1 pour ACTIONS et FILTERING, carte de sous-chapitre niveau 2 repliable), nouveau bloc FILTERING englobant la recherche et les sept axes, espacements, forme des pills, état local d'ouverture par sous-chapitre, calcul du nombre de valeurs actives par sous-chapitre.
- **Modifier** : `components/CapabilityTreeFilter.tsx` — uniquement le rayon et le fond de son champ de recherche, pour rester cohérent avec le reste du panneau. Son arbre, ses chevrons et son état interne ne changent pas.
- **Réutiliser** : `components/icons/ChevronIcon.tsx` — même icône, tournée selon l'état, comme le fait déjà `CapabilityTreeFilter`.
- **Non touché** : `components/FilterSheet.tsx` et `components/MapClient.tsx` (ils rendent déjà `FilterBar`), `components/CatalogueClient.tsx` (le jeton de réinitialisation déjà transmis suffit), `lib/catalogueFilters.ts`, `lib/applications.ts`, `lib/filterDescription.ts` — la valeur de filtre ne change pas.

## Edge Cases
- **Chapitre replié portant des filtres actifs** → le catalogue reste filtré ; le compteur sur l'en-tête est le seul indice, il doit donc être présent sans exception.
- **Tous les sous-chapitres repliés** → le panneau se réduit aux deux titres de bloc, à la recherche, aux actions et à sept lignes d'en-tête ; il se lit alors comme une table des matières à deux niveaux, reste parfaitement utilisable et aucun filtre n'est perdu.
- **Panneau sans rangée ACTIONS** (`/map`) → « FILTERING » est le premier titre du panneau et reste affiché ; il ne doit pas paraître orphelin ni être masqué faute de pendant.
- **Section Business Capabilities absente** → « FILTERING » couvre les six axes restants, sans changement de rendu.
- **Libellé long dans un en-tête de sous-chapitre** (« Business Criticality », « Business Capabilities ») → à la taille réduite du niveau 2, avec compteur et triangle en fin de ligne, la ligne doit tenir sans rogner le libellé ni chasser le triangle hors de la carte.
- **Panneau rendu sur un fond de même couleur que les cartes** (sheet mobile) → les cartes restent délimitées par leur bordure.
- **Chapitre vide** (aucune option disponible pour cet axe, par exemple aucun portfolio dans le jeu de données) → le chapitre reste repliable ; déplié, il montre simplement une zone vide, comme aujourd'hui.
- **Business Capabilities absent** (arbre non chargé) → aucun en-tête, donc rien à replier ; les six autres chapitres fonctionnent normalement.
- **Chapitre Business Capabilities replié avec des nœuds dépliés à l'intérieur** → rouvrir le chapitre restitue l'arbre dans l'état exact où il était.
- **Réinitialisation depuis le menu** → chapitres redéployés, sélections vidées, arbre des capabilities replié : les trois effets vont ensemble.
- **Sheet mobile ouverte, chapitres repliés puis sheet refermée et rouverte** → l'état d'ouverture des chapitres de la session en cours est conservé, la sheet n'étant qu'un conteneur.
- **Navigation Catalogue → fiche détail → retour** → les filtres sont restaurés par le mécanisme existant ; l'état d'ouverture des chapitres, lui, revient au défaut (tout déplié), ce qui est acceptable puisque les compteurs signalent les filtres actifs.
- **Clic sur l'en-tête en navigation clavier** → même bascule qu'au clic souris, sans effet de bord sur la valeur du chapitre.

## Open Questions
- **Faut-il, dans un second temps, replier par défaut les chapitres sans sélection** (panneau compact à l'arrivée) plutôt que tout déplier ? Écarté ici pour ne pas changer le premier affichage, mais à reconsidérer si le panneau continue de grandir => déplier par défaut

- **Un bouton « tout replier »** dans l'en-tête du panneau vaudrait-il la place qu'il prend, une fois l'usage observé ? => pas dans cette version

- **Faut-il, une fois FILTERING posé, afficher sur son titre un compteur global de filtres actifs** (somme des compteurs de ses sous-chapitres) ? Redondant avec le compteur `N / M applications` déjà affiché par le catalogue et avec le badge de la sheet mobile — écarté par défaut, à confirmer au design. => non

## Acceptance Criteria
- [ ] Un titre « FILTERING » apparaît au-dessus du champ de recherche global.
- [ ] « FILTERING » et « ACTIONS » ont exactement la même taille, la même graisse et la même casse.
- [ ] Les libellés des sept axes sont en police plus petite que « FILTERING » et « ACTIONS ».
- [ ] Chacun des sept axes est encadré dans une carte à coins arrondis, pleine largeur du panneau, sous « FILTERING ».
- [ ] Les pills de filtre et les champs de saisie du panneau sont à coins arrondis et plus hauts qu'avant.
- [ ] Le rayon des cartes est celui déjà utilisé par les autres cartes de l'application, sans valeur en dur.
- [ ] « FILTERING » est présent sur `/map`, où la rangée ACTIONS est absente.
- [ ] « FILTERING » est présent même lorsque la section Business Capabilities n'a pas chargé.
- [ ] Ni « FILTERING » ni « ACTIONS » ne portent de triangle et aucun des deux ne se replie au clic.
- [ ] Les sept sous-chapitres du panneau de filtres (Photo, Category, Status, Portfolio, Operator, Business Criticality, Business Capabilities) portent un triangle à droite de leur en-tête.
- [ ] Cliquer sur la ligne d'en-tête d'un sous-chapitre le replie, un second clic le déplie.
- [ ] Le triangle pointe vers le bas quand le sous-chapitre est replié et vers le haut quand il est déplié.
- [ ] Une carte repliée se réduit à sa ligne d'en-tête, sans blanc résiduel.
- [ ] Sur un en-tête à libellé long, compteur et triangle restent sur la même ligne sans débordement de la carte.
- [ ] Replier un chapitre ne change ni la liste des applications affichées, ni le compteur global `N / M applications`, ni la pagination.
- [ ] Déplier un chapitre restitue exactement les sélections qui y étaient posées.
- [ ] Plusieurs chapitres peuvent être repliés en même temps, sans qu'en replier un en déplie un autre.
- [ ] Un chapitre portant au moins une valeur active affiche un compteur sur son en-tête, y compris replié.
- [ ] Le compteur d'un chapitre disparaît dès que ses valeurs sont désélectionnées.
- [ ] À la première ouverture de la page, tous les chapitres sont dépliés.
- [ ] Le champ de recherche global, la rangée ACTIONS et les deux titres de bloc restent visibles en permanence.
- [ ] La réinitialisation des filtres redéploie tous les chapitres.
- [ ] Replier puis déplier le chapitre Business Capabilities retrouve l'arbre avec ses nœuds dans le même état déplié/replié.
- [ ] Le comportement est identique dans la sheet mobile et sur `/map`.
- [ ] Les en-têtes sont atteignables et actionnables au clavier, et leur état est exposé sémantiquement.
- [ ] Le panneau reste lisible en thème clair et en thème sombre, sans couleur codée en dur.
- [ ] Aucune dépendance npm ajoutée ; build Next OK (`npm run build`).
