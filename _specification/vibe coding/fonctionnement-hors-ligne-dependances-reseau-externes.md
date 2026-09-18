# Feature Spec: Fonctionnement hors ligne — suppression des dépendances réseau externes

## Summary
- L'application ne doit **émettre aucune requête vers un domaine tiers**. Seuls le backend `atom-synchronizer-dev` et l'origine qui sert l'application elle-même sont des destinations légitimes à l'exécution.
- Audit exhaustif du code (recherche des URL absolues dans `app/`, `components/`, `lib/`, `styles/`) : **trois** sources d'appels externes, et rien d'autre.
  1. **Polices Google Fonts** — `app/globals.css:1` importe Inter, JetBrains Mono et Fraunces depuis `fonts.googleapis.com`, qui redirige vers `fonts.gstatic.com`.
  2. **Fonds de carte MapLibre** — `components/MapView.tsx:9-10` charge deux styles depuis `basemaps.cartocdn.com`, puis leurs tuiles en continu.
  3. **Embarquements Google Docs/Drive** — `lib/google-embed.ts` construit des URL `docs.google.com` / `drive.google.com` affichées en `iframe` par `Gallery.tsx`.
- Les deux premières sont **supprimées** : ce qu'elles apportent peut être embarqué. La troisième est **hors périmètre et assumée comme telle** — voir la décision dédiée.

## Motivation

### La prémisse initiale était fausse, et la conclusion tient quand même
Cette spec a d'abord été écrite en supposant l'application privée d'Internet. C'est inexact, et la précision compte : **le cluster Kubernetes n'a pas d'accès sortant, mais le navigateur du poste client, si.** Or l'application est un export statique servi par nginx — le cluster ne fait aucune requête sortante, il ne fait que servir des fichiers. Les appels vers Google et CARTO partent donc du poste de l'utilisateur, et **fonctionnent aujourd'hui**.

Le sujet n'est donc pas « ça ne marche pas ». C'est « est-ce une bonne pratique, pour une application métier en production, de dépendre d'une infrastructure qu'on ne maîtrise pas ». La réponse retenue est non, pour quatre raisons dont une n'est pas de l'hygiène mais de la conformité.

### Confidentialité et RGPD — la raison déterminante
Charger une police depuis `fonts.googleapis.com` transmet **l'adresse IP du poste client à Google, à chaque page, sans consentement**. Le tribunal régional de Munich l'a jugé contraire au RGPD en janvier 2022 et a condamné l'exploitant du site concerné ; la pratique est depuis déconseillée pour tout service européen. Ici, cela signifie que les IP des collaborateurs partent chez un sous-traitant américain à chaque chargement d'écran, sans base légale identifiée.

Le fond de carte est pire, parce qu'il n'est pas ponctuel : chaque déplacement et chaque zoom indique à CARTO **quelle zone un poste Airbus est en train de regarder**. À terme, quels sites. S'y ajoutent des conditions d'usage et des quotas que leurs fonds gratuits imposent et qu'un usage professionnel n'est pas censé ignorer.

### « Le client a Internet » est vrai en moyenne, faux au cas par cas
Un poste sur VPN, un réseau d'atelier cloisonné, une tablette sur site, un proxy d'entreprise qui filtre les domaines Google : chacun casse les ressources externes pour cet utilisateur-là, et pour lui seul. On hérite d'un mode de panne **qui dépend du poste**, donc non reproductible par qui reçoit le ticket. Et le symptôme n'est pas une erreur : c'est une application subtilement différente — polices en repli, largeurs de texte changées, libellés qui tronquent ailleurs qu'en recette. Personne ne saura dire pourquoi l'écran « ne ressemble pas à la démo ».

### L'argument historique en faveur des CDN de polices est mort
Il reposait sur le cache partagé entre sites. Depuis 2020, tous les navigateurs **partitionnent le cache par site de premier niveau**, précisément pour empêcher ce pistage : le gain n'existe plus. Reste le coût — résolution DNS et poignée TLS vers un domaine tiers, puis un second vers `fonts.gstatic.com` — et la forme la plus pénalisante qui soit, un `@import` en tête de feuille de style, qui **sérialise** les requêtes au lieu de les paralléliser. Auto-héberger est aujourd'hui strictement plus rapide.

### Intégrité et reproductibilité
On sert ce que le tiers sert, sans vérification d'intégrité possible (une feuille CSS qui redirige vers des fichiers de police ne peut pas porter de `SRI`). Le rendu peut changer sans qu'une ligne du dépôt ne bouge.

## Décisions (arbitrées)

### Règle générale
- **Tout ce qui est statique est embarqué** dans le livrable : polices, tracé géographique. Rien n'est chargé depuis un domaine tiers, ni au premier affichage, ni plus tard.
- Le **backend reste la seule origine réseau externe** à l'exécution. Les photos passent déjà par lui (`/api/infos/resource`), et c'est le modèle.
- **Le registre npm n'est pas « Internet ».** La chaîne de build écrit un `.npmrc` depuis `config/.npmrc` avec les identifiants Artifactory, puis fait `npm install` avant `npm run build` (`Jenkinsfile`). Le dépôt visé est un **proxy du registre npm public**. Un paquet npm est donc une source d'approvisionnement légitime ; un téléchargement direct depuis un domaine public au moment du build ne l'est pas.

### Polices
- **Fraunces est importée et utilisée nulle part** : `--font-serif` vaut `Georgia` et aucun composant ne la référence. Elle est supprimée, pas embarquée.
- **Graisses réellement employées**, relevées dans le code (et non reprises de l'import actuel) : Inter **400, 500, 600, 700** ; JetBrains Mono **400, 500**. La graisse Inter **300** est importée aujourd'hui sans aucun usage — elle disparaît aussi.
- **Approvisionnement : les paquets npm `@fontsource/inter` et `@fontsource/jetbrains-mono`**, déclarés en dépendances. Ils contiennent les `.woff2` et leurs licences OFL. Conséquences : aucun binaire versionné au dépôt, aucune étape de téléchargement manuelle, aucune licence à recopier à la main, et une mise à jour qui redevient un `npm update` ordinaire.
  - **À confirmer avant de coder** : que le proxy Artifactory sert bien ces deux paquets (`npm view @fontsource/inter version` avec le `.npmrc` en place). Un proxy « public » les a en principe ; s'il applique une liste blanche, cela se voit immédiatement.
  - **Repli si le proxy ne suit pas** : télécharger les `.woff2` une fois en phase de développement — qui, elle, a accès à Internet — et les **versionner au dépôt** avec leurs textes de licence. Plus lourd à maintenir, mais fonctionnellement équivalent.
- **Le mécanisme de polices Google de Next (`next/font/google`) est explicitement écarté.** Il a l'air de résoudre le problème puisqu'il sert les fichiers depuis l'origine de l'application, mais il les **télécharge depuis `fonts.gstatic.com` pendant `next build`**. Il déplace la dépendance externe dans la chaîne de build au lieu de la supprimer.
- **Le mécanisme de polices locales (`next/font/local`) est la voie retenue** : il ne fait que lire des fichiers présents sur le disque. C'est aussi ce qui règle le point technique déterminant — le build produit un export statique (`output: "export"`) servi derrière un `basePath`. Une règle `@font-face` écrite à la main dans `app/globals.css` devrait référencer les fichiers par une URL relative au CSS compilé, émis sous `_next/static/css/…` : chemin fragile, et qui ignore le préfixe d'URL de la passerelle. Le chargeur de polices, lui, émet les fichiers et réécrit les URL en tenant compte du `basePath`.
- Les jetons `--font-sans` / `--font-mono` restent le point d'entrée unique côté styles : ils pointent vers les variables CSS produites par le chargeur. `tailwind.config.ts` n'a pas à changer, il lit déjà ces jetons.

### Fond de carte — remplacement, pas dégradation
- **Ce sont deux objets différents, pas deux variantes du même.** L'existant est une *carte glissante* : MapLibre télécharge des tuiles vectorielles chez CARTO au fil des déplacements — routes, villes, bâtiments, étiquettes, détail qui s'affine jusqu'à la rue. La cible est un *tracé* : un fichier TopoJSON de contours de pays (Natural Earth), projeté en chemins SVG par `d3-geo`. Ni route, ni ville, ni étiquette, et un niveau de détail **figé** — zoomer agrandit le tracé sans en révéler davantage.
- **Ce qui est perdu, dit franchement** : le détail au-delà du contour national, les étiquettes de lieux, le zoom infini, et les commandes de navigation natives (`NavigationControl`). Un déplacement/zoom, s'il s'avère nécessaire, serait à refaire avec `d3-zoom`. C'est le seul coût de développement réel du lot.
- **Pourquoi ce n'est pas un renoncement** : `components/MapView.tsx` fait 39 lignes, n'affiche **aucun marqueur**, et superpose un bandeau « No location data available yet ». Le modèle ne porte pas encore de coordonnées ; la carte cadre l'Europe au zoom 3.5 et rien d'autre. Quand les coordonnées arriveront, le besoin sera de poser quelques points — Toulouse, Hambourg, Filton, Brême — sur un fond permettant de dire « ça, c'est en France ». À cette échelle, un contour de pays suffit ; personne n'a besoin de voir la rue d'un banc d'essai.
- **Tout est déjà au dépôt** : `d3-geo`, `topojson-client` et **`world-atlas`** sont déjà des dépendances de développement, et `public/maps/` existe — vide. Vraisemblablement une tentative précédente. Le fond de carte ne demande donc **aucun téléchargement**, seulement d'être branché. `world-atlas` fournit `countries-110m.json` (105 Ko), `countries-50m.json` (739 Ko, très compressible) et `land-*.json`. **`50m` est le bon niveau** pour un rendu continental soigné ; une extraction restreinte à l'Europe au moment du build reste possible si le poids gêne.
- **`maplibre-gl` et `react-map-gl` sortent des dépendances** : 803 Ko de JavaScript minifié et 65 Ko de CSS en moins, pour la seule page `/map`.
- **Le thème clair/sombre devient trivial.** Aujourd'hui `MapView` choisit entre **deux styles CDN distincts** (`positron` / `dark-matter`) ; avec un SVG, c'est un `fill` qui lit les jetons de couleur existants. La carte s'accorde enfin réellement au reste de l'application au lieu de s'en approcher.
- **Le jour où un vrai fond détaillé serait exigé** — zoomer sur le site de Toulouse et voir les bâtiments — aucun fichier embarqué ne suffira : il faudra un serveur de tuiles interne. C'est une décision d'infrastructure, pas un lot de développement, et elle reste hors périmètre.

### Documents Google — hors périmètre, et c'est une décision
- Un document hébergé par Google est par nature inaccessible hors ligne : **il n'y a rien à embarquer**. Et puisque le navigateur client dispose d'Internet, les `iframe` fonctionnent aujourd'hui.
- C'est donc **la seule exception assumée** à la règle « aucun appel externe » : une ressource externe par nature, ouverte délibérément par l'utilisateur, dont l'échec n'empêche pas l'application de fonctionner. Elle est consignée ici pour qu'un audit futur la trouve comme un choix et non comme un oubli.
- Le repli explicite (message et lien plutôt qu'un cadre muet) reste souhaitable — pour un document supprimé, déplacé ou sans droit d'accès — mais relève d'un autre lot : c'est de la robustesse d'affichage, plus de l'indépendance réseau.

### Chaîne de build
- **Ni le cluster ni le build n'atteignent Internet.** Seules la phase de développement et le poste client l'atteignent. Le build ne doit télécharger aucune ressource ; tout au plus installe-t-il ses dépendances depuis le proxy Artifactory.
- `npm start` lance `npx --yes serve out -l 3001`, qui va chercher `serve` sur le registre : la commande échoue sur une machine de développement hors ligne. Point mineur — ce n'est **pas** le mode de déploiement, la production sert `out/` par nginx. À régler en déclarant `serve` en dépendance de développement, ou en documentant que la commande n'est pas un chemin de production.

### Vérifiabilité
- Il doit être possible de **prouver** l'absence d'appel externe autrement qu'en relisant le code, sans quoi la prochaine dépendance externe réapparaîtra sans bruit — d'autant plus facilement que, le navigateur client étant connecté, **elle fonctionnera** et ne se signalera donc jamais d'elle-même.
- Le garde-fou visé est **automatisé et exécuté sur le livrable** (`out/`, pas seulement les sources) : toute URL absolue vers un domaine autre que le backend fait échouer la vérification. La liste des exceptions — les URL Google Docs — y est explicite et courte.

## Requirements

### Functional Requirements
- Aucune requête vers un domaine tiers n'est émise lors de la navigation sur `/`, `/map`, `/discover` et la page de détail, à la seule exception d'une `iframe` Google ouverte par l'utilisateur.
- Les typographies affichées sont celles d'aujourd'hui, y compris les graisses employées et les chiffres tabulaires, sans accès à Internet.
- `/map` affiche un fond de carte exploitable hors ligne, cohérent en thème clair et sombre.
- Le reste de l'application (catalogue, filtres, Discover, exports, photos) fonctionne à l'identique.

### Non-Functional Requirements
- Le poids du livrable doit **baisser**, pas augmenter : le retrait de `maplibre-gl` et `react-map-gl` (868 Ko) dépasse largement l'ajout des polices (~150 à 200 Ko) et du tracé.
- Aucune régression de performance au premier affichage ; l'objectif est au contraire de supprimer des attentes réseau sur le chemin critique.
- Aucune dégradation visuelle sur la typographie : les polices embarquées sont exactement celles d'aujourd'hui, pas des approximations.
- Le `basePath` de la passerelle AFTER reste correctement appliqué à toutes les ressources embarquées.
- Les licences des ressources redistribuées accompagnent le livrable.
- La solution tient avec l'export statique (`output: "export"`) et le conteneur nginx qui sert `out/`.

## Scope

### In Scope
- Suppression de l'import Google Fonts et embarquement d'Inter et JetBrains Mono aux graisses utilisées ; suppression de Fraunces et de la graisse Inter 300.
- Remplacement du fond de carte CARTO par un rendu géographique local, et retrait de `maplibre-gl` / `react-map-gl`.
- Correctif du script `npm start`.
- Garde-fou automatisé de non-régression sur les URL externes.

### Out of Scope
- **Le repli d'affichage des documents Google** : exception assumée, traitée ailleurs si besoin.
- Toute évolution fonctionnelle de la carte (marqueurs, regroupement par site, géocodage) : le sujet est la disponibilité du fond, pas la donnée.
- Un serveur de tuiles interne, et tout fond de carte détaillé qui en dépendrait.
- Le cache hors ligne des données applicatives : les appels au backend restent des appels au backend.
- Un mode « hors ligne » explicite dans l'interface, avec bascule ou indicateur de connectivité.
- La mise en cache des photos, déjà traitée par le cache IndexedDB existant.
- Les liens sortants ouverts volontairement dans un nouvel onglet : ils ne cassent pas l'application.

## Affected Areas
- **Modifier** — `app/globals.css` : l'`@import` de la ligne 1 disparaît ; `--font-sans` / `--font-mono` pointent vers les variables du chargeur de polices ; le sort de `--font-serif` est à trancher (voir Open Questions).
- **Modifier** — `app/layout.tsx` : point d'entrée naturel pour déclarer les polices locales et les appliquer au document, à côté des scripts anti-FOUC de thème et de densité déjà présents.
- **Réécrire** — `components/MapView.tsx` : 39 lignes aujourd'hui, dont l'essentiel de la logique tient dans le choix du style CDN. Le rendu SVG le remplace intégralement.
- **Modifier** — `package.json` : ajout de `@fontsource/*`, retrait de `maplibre-gl` et `react-map-gl`, promotion de `d3-geo` / `topojson-client` / `world-atlas` en dépendances de production si le rendu les exige à l'exécution, et correctif du script `start`.
- **À exploiter** — `public/maps/`, prévu et vide.
- **Vérifier** — `tailwind.config.ts` : la pile `fontFamily` référence les mêmes jetons et doit rester cohérente.
- **Non touché** — `lib/atom-api.ts` et `lib/usePhoto.ts` : ils ne parlent qu'au backend, ce qui est le comportement visé. `lib/google-embed.ts` et `components/Gallery.tsx` : hors périmètre par décision.

## Edge Cases
- **Polices non chargées malgré l'embarquement**, chemin cassé par le `basePath` → symptôme identique à aujourd'hui, mais plus difficile à diagnostiquer puisqu'on croira le problème réglé. À vérifier explicitement **derrière la passerelle**, pas seulement en local.
- **Graisses manquantes** : le code emploie `font-medium`, `font-semibold` et `font-bold`. N'embarquer qu'un sous-ensemble ferait synthétiser les autres par le navigateur, au rendu gras approximatif.
- **Chiffres tabulaires** : les compteurs de filtres reposent sur `tabular-nums`. La variante embarquée doit le supporter, sinon les nombres se remettent à sautiller.
- **Première peinture** : les scripts anti-FOUC de thème et de densité s'exécutent avant l'hydratation ; l'arrivée des polices ne doit pas introduire un nouveau saut de mise en page.
- **Régression invisible** : le navigateur client étant connecté, une dépendance externe réintroduite plus tard **fonctionnera** et ne se signalera jamais en recette. C'est l'argument central en faveur d'un garde-fou automatisé plutôt que d'une vigilance humaine.
- **Reprise involontaire de `next/font/google`** : casse le build, sans que le code paraisse fautif. La vérification doit savoir l'attraper.
- **Cache navigateur** : un poste ayant déjà chargé les polices ou les tuiles peut donner l'illusion que l'embarquement fonctionne. Les vérifications se font **cache vidé**.
- **Tracé du monde trop grossier** en `110m` sur un cadrage européen : frontières visiblement anguleuses. C'est ce qui motive `50m` par défaut.
- **Projection** : le cadrage actuel (longitude 5, latitude 47, zoom 3.5) n'a pas d'équivalent direct en `d3-geo`. Le cadrage cible est à définir à la main, et à revalider quand des marqueurs apparaîtront.

## Open Questions
- **`--font-serif`** : aucune famille sérif n'est utilisée. On garde le jeton sur `Georgia` — police système, sans coût — ou on le supprime avec Fraunces, ainsi que l'entrée `serif` de `tailwind.config.ts` ?
- **Déplacement et zoom sur `/map`** : le fond local en a-t-il besoin dès maintenant (`d3-zoom`), ou un cadrage fixe sur l'Europe suffit-il tant que la page n'affiche aucun marqueur ?

## Acceptance Criteria
- [ ] Navigateur en mode hors ligne (backend simulé joignable), cache vidé : `/`, `/map`, `/discover` et la page de détail se chargent sans aucune requête vers un domaine tiers.
- [ ] Les textes s'affichent dans les typographies prévues, y compris les graisses employées et les chiffres tabulaires.
- [ ] Aucune référence à `fonts.googleapis.com`, `fonts.gstatic.com` ou `basemaps.cartocdn.com` ne subsiste dans les sources **ni dans `out/`**.
- [ ] Ni Fraunces ni la graisse Inter 300 ne sont chargées.
- [ ] `/map` affiche un fond de carte hors ligne, lisible et cohérent en thème clair et sombre.
- [ ] `maplibre-gl` et `react-map-gl` ne figurent plus dans `package.json`, et le poids du livrable a baissé.
- [ ] Polices et carte se chargent correctement **derrière la passerelle AFTER**, avec le `basePath` en place.
- [ ] Les licences des ressources redistribuées sont présentes au livrable.
- [ ] Le poids ajouté et retiré est mesuré et documenté.
- [ ] Un garde-fou automatisé échoue dès qu'une URL externe non listée apparaît dans le livrable.
- [ ] `npm start` fonctionne sans registre npm, ou la documentation dit explicitement que ce n'est pas un chemin de production.
- [ ] Build Next OK, aucune régression sur le catalogue, les filtres, Discover et les exports.
