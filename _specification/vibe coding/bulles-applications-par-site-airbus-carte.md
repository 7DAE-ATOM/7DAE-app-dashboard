# Feature Spec: Bulles d'applications par site Airbus sur la carte

## Summary
- `/map` affiche aujourd'hui un fond de carte mondial et **aucune donnée** : un bandeau « No location data available yet (498 applications loaded) » tient lieu de contenu. L'attribut `airbusSite` rend enfin la page utile.
- Chaque site connu porte une **bulle** dont la taille et le nombre traduisent le **nombre d'applications utilisées sur ce site**, recalculé selon les filtres actifs du panneau latéral.
- Un clic sur une bulle ouvre un **popup** listant les applications concernées, chacune liée vers sa fiche détaillée, ouverte dans un nouvel onglet.
- Les neuf valeurs annoncées sont situables sans ambiguïté — **sauf `all`**, qui n'est pas un lieu et dont le traitement conditionne la lisibilité de toute la carte (voir Open Questions).

## Motivation
- La page carte existe dans la navigation principale, occupe un plein écran, et ne dit rien. C'est le seul écran du produit dont le contenu se résume à un message d'absence.
- La question « quelles applications tourne-t-on à Toulouse ? » n'a aujourd'hui aucune réponse dans l'outil, alors que la donnée est présente dans le modèle depuis le début : `airbusSite` est déjà remonté par la requête LeanIX et déjà affiché, en texte brut, dans l'onglet Identité d'une fiche.
- Une carte est le bon instrument pour cette question précise : elle répond à **où**, et elle donne d'un coup d'œil la répartition géographique du parc applicatif — information qu'aucune liste ne transmet aussi vite.
- Le fond de carte hors ligne vient d'être mis en place et embarque déjà, sans être dessiné, un **panneau Europe** généré exprès pour ce cas : les sites européens sont trop rapprochés à l'échelle mondiale pour y porter des bulles. Le matériau est prêt.

## Décisions (arbitrées)

### Situer les sites
- Les neuf valeurs correspondent à des implantations identifiables. Les coordonnées retenues visent **l'établissement Airbus**, pas le centre-ville :

  | Valeur | Site | Latitude | Longitude |
  |---|---|---|---|
  | `toulouse` | Toulouse-Blagnac, France | 43,63 | 1,37 |
  | `filton` | Filton (Bristol), Royaume-Uni | 51,51 | −2,58 |
  | `hambourg` | Hambourg-Finkenwerder, Allemagne | 53,53 | 9,84 |
  | `bremen` | Brême, Allemagne | 53,05 | 8,79 |
  | `getafe` | Getafe (Madrid), Espagne | 40,30 | −3,72 |
  | `bengalore` | Bengaluru, Inde | 12,97 | 77,59 |
  | `mirabel` | Mirabel (Québec), Canada | 45,68 | −74,03 |
  | `mobile` | Mobile (Alabama), États-Unis | 30,69 | −88,04 |
  | `tjn` | Tianjin, Chine | 39,13 | 117,20 |

- La table de correspondance est **tenue dans le code**, pas déduite. Aucune géolocalisation, aucun service de géocodage : neuf entrées écrites une fois.
- Les huit sites hors `all` tombent tous dans le cadre du panneau mondial existant, vérifié.

### Normaliser les valeurs, et ne rien perdre en silence
- Les valeurs sont de la **saisie libre côté LeanIX**, pas une énumération contrôlée : `tjn` est une abréviation, `bengalore` une orthographe approximative de Bengaluru. La correspondance doit donc être tolérante — casse, espaces, accents — et reposer sur une liste d'alias par site plutôt que sur une égalité stricte.
- **Une valeur inconnue ne doit jamais disparaître sans bruit.** C'est le piège classique de ce genre de table : un nouveau site ouvre, personne ne met la table à jour, et la carte continue d'afficher un total crédible mais faux. L'écran doit indiquer combien d'applications portent un site non reconnu, et lesquelles, pour que l'écart se voie.
- Le nombre total d'applications situées, plus les non reconnues, plus celles sans site, doit se réconcilier avec l'effectif filtré. Cette réconciliation est un critère d'acceptation, pas un confort.

### Une application peut être sur plusieurs sites
- **L'API renvoie un tableau** (`airbusSite: string[]`), et l'adaptateur le réduit aujourd'hui à une chaîne unique par concaténation. Cette mise à plat est **destructrice pour cette fonctionnalité** : elle doit cesser, ou être doublée d'un champ conservant les valeurs individuelles. L'affichage actuel dans l'onglet Identité doit continuer de fonctionner à l'identique.
- Conséquence à assumer et à afficher : **la somme des bulles dépasse le nombre d'applications**. Les bulles ne partitionnent pas le parc, elles le recouvrent. Une légende doit le dire, faute de quoi un lecteur additionnera les nombres et conclura à une erreur.

### Les bulles
- Le nombre est **celui des applications visibles**, c'est-à-dire après application des filtres du panneau latéral — exactement l'ensemble déjà calculé pour la page. Modifier un filtre met les bulles à jour sans rechargement.
- La taille encode le nombre **par l'aire**, pas par le rayon : un disque de rayon double paraît quatre fois plus gros, et encoder linéairement sur le rayon exagère massivement les écarts. Un rayon minimal garantit qu'un site à une seule application reste cliquable ; un rayon maximal empêche une bulle d'avaler ses voisines.
- Le nombre est **écrit dans la bulle** quand elle est assez grande, à côté sinon. L'œil compare mal les aires : le chiffre est la vraie information, la taille n'est qu'un repère de survol.
- Un site dont le compte tombe à zéro après filtrage **disparaît**. Neuf bulles à zéro ne renseignent sur rien et encombrent ; leur absence est elle-même l'information.

### L'encombrement européen, et l'encart
- Cinq des neuf sites tiennent dans dix degrés. À l'échelle mondiale, **Hambourg et Brême sont distants de 8 unités de canevas** et Toulouse–Getafe de 38, quand une bulle dimensionnée par un compte en fera couramment 60. Le chevauchement n'est pas un cas limite, c'est le cas nominal.
- Le fond de carte embarque déjà un panneau `EUROPE` prévu pour ça, où ces mêmes écarts passent à 39 et 185 — presque cinq fois plus d'air. C'est l'**encart** à dessiner, en complément du planisphère et non à sa place, puisque Bengaluru, Mirabel, Mobile et Tianjin n'y figurent pas.
- Un site apparaît donc **sur les deux vues** s'il est européen, sur la seule vue mondiale sinon. Les deux bulles d'un même site portent le même nombre et le même comportement au clic.
- **L'encart casse la comparaison d'échelle** : à rayon égal, une bulle de l'encart et une bulle du planisphère ne représentent pas la même chose pour l'œil, puisque le contexte géographique diffère. Cette limite est **acceptée**. La parade retenue n'est pas cartographique : c'est d'accompagner la carte d'une lecture chiffrée exacte — le nombre inscrit dans chaque bulle, et le popup qui donne le détail.

### Le popup
- Ouvert au clic sur une bulle, il liste les applications de ce site, **dans le périmètre filtré courant**, triées par nom.
- Chaque entrée est un lien vers la fiche détaillée, **ouvert dans un nouvel onglet**, selon la convention d'URL déjà en place dans le catalogue et l'onglet « En contexte ».
- Un seul popup ouvert à la fois : deux popups sur une carte se recouvrent et se disputent la place. Il se ferme par sa croix, par un clic hors de lui, et par Échap.
- La liste peut être longue — plusieurs centaines d'applications sur un site principal. Elle défile, annonce son effectif en en-tête, et reste utilisable au clavier.
- Le popup ne doit pas sortir du cadre de la carte ni masquer le panneau de filtres : son placement s'adapte à la position de la bulle.

### Ce que la carte ne fait pas
- Cliquer une bulle **n'applique aucun filtre**. Le popup est une lecture, pas une navigation : le panneau latéral reste la seule source de vérité du périmètre, et une carte qui filtre en douce rend l'état de l'écran illisible.
- Aucun appel réseau supplémentaire : `airbusSite` arrive déjà avec les applications, et les contours sont embarqués. La page ne doit contacter que le backend, comme le reste de l'application.

## Requirements

### Functional Requirements
- Chaque site reconnu porte une bulle positionnée à ses coordonnées, sur le planisphère et, s'il est européen, sur l'encart.
- Le nombre affiché est celui des applications visibles après filtrage, et suit toute modification de filtre sans rechargement.
- Un clic sur une bulle ouvre un popup listant ces applications par nom, chacune liée vers sa fiche, ouverte dans un nouvel onglet.
- Les applications dont le site n'est pas reconnu, et celles sans site, sont **dénombrées et signalées**, jamais omises silencieusement.
- Le bandeau « No location data available yet » disparaît au profit des bulles.
- Le reste de la page — panneau de filtres, feuille mobile, export — fonctionne à l'identique.

### Non-Functional Requirements
- Aucune requête réseau nouvelle, et aucune vers un domaine tiers.
- Le recalcul des comptes à chaque changement de filtre doit rester imperceptible sur le parc actuel (~500 applications, 9 sites).
- Les bulles et le popup s'accordent aux deux thèmes clair et sombre par les jetons de couleur existants, sans logique JavaScript de thème.
- La carte reste utilisable sur écran étroit, où l'encart et le popup sont le plus à l'étroit.
- Bulles et liens sont atteignables au clavier et annoncés correctement : un disque SVG n'est rien pour un lecteur d'écran s'il n'est pas décrit.

## Scope

### In Scope
- Table de correspondance site → coordonnées, avec alias et tolérance de saisie.
- Conservation des valeurs multiples de `airbusSite` dans le modèle.
- Bulles sur le planisphère, dénombrement selon le filtre courant.
- Dessin de l'encart Europe, déjà généré et actuellement inutilisé.
- Popup de détail avec liens vers les fiches.
- Décompte et signalement des applications non situées.

### Out of Scope
- Toute modification du panneau de filtres, y compris l'ajout d'un axe « site ».
- Le filtrage de la page par clic sur une bulle.
- Le déplacement, le zoom ou le recadrage interactif de la carte.
- Un fond de carte plus détaillé, et le serveur de tuiles interne qu'il supposerait.
- La correction des valeurs `airbusSite` à la source : l'application affiche ce que LeanIX contient, elle ne le nettoie pas.
- L'export PDF ou image de la carte avec ses bulles.
- Des sites supplémentaires non présents dans les données.

## Affected Areas
- **Modifier** — `lib/application-adapter.ts` : la concaténation des valeurs de site y est faite ; c'est le point exact où l'information multiple est aujourd'hui perdue.
- **Modifier** — `lib/types.ts` : le type d'application doit porter les sites individuellement, sans casser l'affichage texte de l'onglet Identité.
- **Réécrire** — `components/MapView.tsx` : aujourd'hui limité au tracé du planisphère et au bandeau d'absence ; c'est là qu'arrivent les bulles, l'encart et le popup.
- **À exploiter** — le panneau `EUROPE` du fond de carte généré, et l'utilitaire de projection qui place une coordonnée sur un panneau. Les deux existent et ne sont pas encore utilisés.
- **À exploiter** — la convention d'URL de fiche détaillée déjà employée par le catalogue et l'onglet « En contexte ».
- **Vérifier** — `components/MapClient.tsx` : il calcule déjà l'ensemble filtré et le transmet à la carte ; le contrat de prop ne devrait pas changer.
- **Non touché** — la couche API et la requête LeanIX : `airbusSite` y est déjà demandé.

## Edge Cases
- **`all`** — le cas qui décide de tout, traité en Open Questions.
- **Application sans site** (`airbusSite` vide ou nul) : ne figure sur aucune bulle. Doit être comptée à part, sans quoi l'écart avec l'effectif total passe inaperçu.
- **Valeur inconnue** : même traitement, et distincte de l'absence — « site non reconnu » et « site non renseigné » sont deux problèmes différents, l'un de la table, l'autre de la donnée.
- **Application sur plusieurs sites** : comptée dans chaque bulle concernée, et pouvant apparaître dans plusieurs popups.
- **Filtrage vidant un site** : la bulle disparaît ; si tous les sites sont vides, la carte doit le dire plutôt que de rester nue.
- **Site sans application mais reconnu** : jamais affiché, pour ne pas laisser croire à une donnée manquante.
- **Popup ouvert quand le filtre change** : son contenu doit suivre le nouveau périmètre, ou se fermer — il ne doit pas afficher une liste devenue fausse.
- **Bulle très grande** : un site principal concentrant l'essentiel du parc produira un disque qui peut couvrir ses voisins ; c'est ce que le rayon maximal doit contenir.
- **Hambourg et Brême sur le planisphère** : à 8 unités d'écart, ils se recouvriront quelle que soit la taille choisie. La vue mondiale doit rester lisible malgré ce recouvrement — l'encart est la réponse, pas un correctif optionnel.
- **Liens en nouvel onglet** : doivent rester sûrs et ne pas exposer la page d'origine.
- **Écran étroit** : l'encart peut ne pas tenir. Mieux vaut le masquer que l'écraser.

## Open Questions

- **Que fait-on de `all` ?** C'est la question qui conditionne la lisibilité de l'écran, et elle doit être tranchée avant de coder.

  Le compter sur chacun des huit sites est la lecture littérale — une application « tous sites » est effectivement utilisée partout. Mais elle ajoute la **même constante à toutes les bulles**, ce qui écrase précisément la différence que la carte est censée montrer : si deux cents applications sont déclarées `all`, Bengaluru en affiche deux cent et quelques et Toulouse deux cent soixante, et la carte ne raconte plus rien d'autre que le poids de `all`.

  **Recommandation** : les exclure des bulles par défaut et les annoncer à part — « N applications déclarées sur tous les sites, non représentées » — avec la possibilité de les réintégrer si l'utilisateur le demande explicitement. La carte garde alors son pouvoir discriminant, et l'information n'est pas perdue. => suivre recommendation

  À confirmer, car le choix change ce que tout le monde lira sur cet écran.

- **L'encart Europe est-il toujours affiché**, ou seulement quand au moins deux sites européens sont visibles après filtrage ? Le masquer quand il ne sert pas libère de la place ; le garder évite que la carte change de structure à chaque filtre. => toujours l'afficher

- **Où placer le décompte des non situées** — `all`, sites inconnus, sites absents ? Une mention discrète au bord de la carte, ou une ligne dans le panneau latéral, à côté de l'effectif déjà affiché ? => une mention discréte en haut de la carte, cliquable aussi pour avoir accés à la liste des applications concernées

## Acceptance Criteria
- [ ] Les neuf sites reconnus, moins `all`, apparaissent aux bonnes positions géographiques sur le planisphère.
- [ ] Chaque bulle porte le nombre d'applications du site dans le périmètre filtré, et ce nombre change à chaque modification de filtre sans rechargement.
- [ ] Un clic ouvre un popup listant les applications de ce site, triées par nom ; chaque lien ouvre la fiche détaillée dans un nouvel onglet.
- [ ] Le total des applications situées, augmenté des non reconnues, des non renseignées et de celles écartées au titre de `all`, se réconcilie exactement avec l'effectif filtré affiché.
- [ ] Une valeur de site absente de la table est signalée à l'écran, avec son nombre.
- [ ] Une application déclarée sur plusieurs sites apparaît sur chacun, et la légende avertit que la somme des bulles dépasse l'effectif.
- [ ] L'encart Europe sépare visiblement Hambourg et Brême, qui se recouvrent sur le planisphère.
- [ ] Un site sans application après filtrage n'affiche pas de bulle.
- [ ] Bulles et liens sont atteignables et actionnables au clavier, et décrits pour un lecteur d'écran.
- [ ] Le rendu est correct dans les deux thèmes, et sur écran étroit.
- [ ] L'onglet Identité continue d'afficher les sites comme aujourd'hui.
- [ ] Aucune requête réseau nouvelle ; le contrôle d'absence de dépendance tierce reste au vert.
- [ ] Build Next OK, aucune régression sur le catalogue, les filtres, Discover et les exports.
