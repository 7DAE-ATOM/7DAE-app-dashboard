# Feature Spec: Onglet In Context — diagramme en étoile des liens inter-applications

## Summary
- Implémenter le contenu de l'onglet **IN CONTEXT** de la fiche `/application?id=<externalId>`, laissé en placeholder par `onglets-fiche-application-identity.md`.
- L'onglet affiche un **diagramme en étoile** : l'application courante au centre, ses applications liées disposées en couronne autour d'elle, reliées par des arêtes fléchées.
- Les liens proviennent d'un **nouvel appel REST** : `GET /api/infos/applications/{externalId}/links`.
- Le rendu est un **SVG inline maison** (calcul de layout polaire côté composant), pas de bibliothèque de graphe.
- Le diagramme est un **composant générique et réutilisable**, indépendant du domaine « application » : il prend un nœud central et une liste de voisins, et ne connaît ni le DTO backend, ni la fiche application, ni l'onglet qui l'héberge. L'onglet In Context n'en est que le **premier consommateur**.
- Ce contenu **remplace** le schéma statique "Functional Interfaces" (LeanIX / Google Workspace / ADAM / Alfabet) et les chips "Business Objects" du prototype artefact : ces éléments décrivent le produit ATOM lui-même, pas la donnée d'une application, et n'ont pas leur place sur une fiche application.

## Motivation
- La fiche application montre aujourd'hui uniquement les attributs propres à l'application ; rien n'indique sa place dans le paysage applicatif (qui la consomme, qui elle consomme).
- Cette information existe déjà côté backend et est directement exploitable : le endpoint `/links` renvoie une liste plate d'applications voisines avec un sens de circulation.
- Une étoile est la représentation la plus lisible pour un graphe **ego-centré à un niveau** : la hiérarchie visuelle (centre = sujet, couronne = voisins) est immédiate, sans avoir à apprendre à naviguer dans un canvas.
- Le choix du SVG maison plutôt que React Flow est un arbitrage assumé : React Flow ne calcule pas le layout (il faut de toute façon écrire le placement polaire soi-même), coûte ~50 ko gzip, impose un import client-only et un retravail du thème light/dark, pour n'apporter que du pan/zoom/drag dont cette vue statique n'a pas besoin.

## Décisions (arbitrées)
- **Composant générique réutilisable** : le diagramme est un composant autonome de la bibliothèque de composants du repo (au même titre que `Avatar` ou `Gallery`), **découplé du domaine applicatif**. Il expose une API de props neutre (`center`, `neighbors`, libellés, gestionnaire de clic ou lien par nœud) et ne fait **aucun appel réseau** ni aucune lecture de `useSearchParams`. Il doit pouvoir être posé tel quel sur une autre page — fiche Lab Test Mean, vue portfolio, futur écran de cartographie — sans modification, en lui passant simplement un autre jeu de nœuds. Les spécificités « application » (fetch `/links`, adaptation du DTO, URL de destination) vivent dans le composant d'onglet appelant, pas dans le diagramme.
- **Rendu** : SVG inline maison, `viewBox` + `preserveAspectRatio` pour la responsivité. Pas de React Flow, pas de d3, pas de dépendance nouvelle.
- **Layout** : disposition polaire, angle du voisin `i` = `-90° + i × 360/n` (premier voisin en haut, sens horaire).
- **Densité** : **deux anneaux concentriques**. Au-delà de ~12 voisins, les 12 premiers sont placés sur un anneau interne et le reste sur un anneau externe, avec un décalage angulaire entre les deux anneaux pour éviter l'alignement radial des étiquettes. En dessous du seuil, un seul anneau. La volumétrie maximale connue du référentiel est de **~30 liens**, entièrement couverte par les deux anneaux : le pan/zoom reste donc hors périmètre.
- **Sens des arêtes** : dérivé de l'attribut `direction`, dont le backend renvoie **trois valeurs** :
  - `inbound` → flèche du voisin vers l'application courante.
  - `outbound` → flèche de l'application courante vers le voisin.
  - `both` → arête à **double flèche**. La bidirectionnalité est **fournie explicitement par l'API**, elle n'est pas déduite côté frontend.
  - Toute autre valeur, ou valeur absente → arête sans flèche (relation connue mais sens indéterminé), le nœud reste affiché.
- **Pas de fusion côté client** : l'API a déjà dédupliqué les interfaces multiples entre deux mêmes applications ; une application n'apparaît donc pas deux fois. Si le cas se produit malgré tout, le frontend **affiche les deux entrées telles quelles** plutôt que de les fusionner — il ne masque pas une anomalie de données.
- **Navigation** : chaque nœud voisin est cliquable et navigue vers `/application?id=<externalId>` du voisin — le diagramme devient un outil d'exploration de proche en proche.
- **Contenu de l'onglet** : le diagramme **uniquement**. Le schéma statique "Functional Interfaces" et les chips "Business Objects" du prototype ne sont pas portés.
- **Chargement** : appel réseau **dédié et paresseux**, déclenché à la première activation de l'onglet In Context, pas au chargement de la fiche — la majorité des consultations de fiche ne l'ouvriront pas.
- **Identité visuelle** : tokens `--color-*` existants et adaptation automatique light/dark, comme le reste du repo. Pas de palette ad hoc reprise de l'artefact.

## Requirements

### Functional Requirements
- L'onglet In Context de la fiche application affiche un diagramme en étoile centré sur l'application courante.
- Le nœud central porte le nom et l'`externalId` de l'application courante et se distingue visuellement des voisins (traitement accent).
- Chaque nœud voisin porte le nom et l'`externalId` de l'application liée.
- Chaque nœud voisin est relié au centre par une arête dont l'extrémité fléchée traduit le `direction` : entrant (`inbound`), sortant (`outbound`), ou bidirectionnel (`both`, double flèche).
- Cliquer un nœud voisin navigue vers la fiche de cette application (`/application?id=<externalId>`).
- Le survol d'un nœud ou d'une arête met en évidence le couple nœud+arête concerné et atténue les autres, pour rendre lisible une étoile dense.
- Une légende indique la signification des trois formes d'arêtes (entrant / sortant / bidirectionnel).
- Un compteur ou intitulé indique le nombre d'applications liées.
- Les liens sont chargés par un appel dédié au endpoint `/links`, déclenché à la première ouverture de l'onglet et mis en cache pour les ouvertures suivantes de la même fiche.
- Pendant le chargement, l'onglet affiche un état de chargement cohérent avec les squelettes déjà utilisés sur la fiche.
- Le composant de diagramme est utilisable depuis n'importe quelle page du repo en lui passant un nœud central et une liste de voisins, sans dépendance à la fiche application : le comportement au clic est fourni par l'appelant, et le libellé/l'identifiant secondaire de chaque nœud sont des données d'entrée, pas des champs codés en dur.

### Non-Functional Requirements
- **Aucune dépendance npm nouvelle** : rendu 100 % SVG inline + CSS du repo.
- **Rendu serveur/client** : le diagramme ne dépend d'aucune API navigateur et n'a pas besoin d'un import `dynamic`/`ssr: false` (contrairement à `MapView`).
- **Thème** : couleurs exclusivement issues des tokens `--color-*` ; le diagramme doit être lisible en clair comme en sombre sans code spécifique au thème.
- **Responsive** : le diagramme s'adapte à la largeur du conteneur via `viewBox`, sans média-queries ni recalcul JS au redimensionnement.
- **Découplage / réutilisabilité** : le composant de diagramme est **pur et sans effet de bord** — pas de fetch, pas de SWR, pas de hook de routing, pas de dépendance à `Application`. Son modèle d'entrée est un couple `{ center, neighbors[] }` neutre vis-à-vis du DTO backend. Deux conséquences attendues : (1) un futur passage à un moteur de graphe ou à un graphe multi-niveaux n'impacte que l'adaptateur ; (2) une autre page peut le réutiliser sans embarquer la logique « application ».
- **Placement** : le composant générique est rangé dans `components/` à la racine (bibliothèque partagée), et non dans un sous-dossier propre à la fiche application, pour signaler explicitement son statut de composant réutilisable. Il suit les conventions de structuration/documentation de composants du repo (`component-conventions`).
- **Isolation des pannes** : une erreur sur `/links` n'affecte que l'onglet In Context — le reste de la fiche continue de fonctionner (pas de bascule vers l'écran d'erreur global `app/error.tsx`).

## Scope

### In Scope
- Typage du DTO de lien et fonction de fetch du endpoint `/links` dans la couche API.
- Adaptateur transformant la réponse `/links` en modèle de graphe générique (mapping `direction` → sens d'arête, libellés, tri stable des voisins). Pas de déduplication ni de fusion : l'API les a déjà faites.
- Hook de chargement paresseux avec cache, aligné sur le pattern SWR déjà en place sur la fiche.
- **Composant générique de diagramme en étoile** (SVG inline, réutilisable) : calcul du layout un ou deux anneaux, nœuds, arêtes, marqueurs de flèches, légende, survol, déclenchement du clic délégué à l'appelant.
- Composant de panneau d'onglet In Context assemblant chargement / erreur / vide / diagramme.
- Branchement dans la barre d'onglets de la fiche, en remplacement du placeholder.

### Out of Scope
- **Exploration multi-niveaux** (déplier les voisins des voisins, ré-centrage du graphe) — une itération ultérieure si le besoin se confirme.
- **Pan / zoom / drag** des nœuds.
- Filtrage des liens par type, direction ou catégorie d'application.
- Enrichissement des nœuds voisins avec des attributs supplémentaires (statut, criticité, catégorie) : cela nécessiterait un appel par voisin ou un croisement avec la liste complète des applications, hors périmètre.
- Export du diagramme (PNG/SVG) et intégration à l'export PDF de la fiche.
- Le schéma statique "Functional Interfaces" et les chips "Business Objects" du prototype artefact, explicitement abandonnés.
- Toute écriture vers le backend.

## Affected Areas
- **Modifier** : `lib/atom-api.ts` — ajout du type du DTO de lien et de la fonction de fetch `/links` (mêmes helpers `atomFetch` / `httpError` / diagnostics que les appels existants).
- **Modifier** : `lib/types.ts` — types du modèle de graphe côté frontend (nœud voisin, sens de relation).
- **Créer** : un adaptateur de liens (DTO `/links` → modèle de graphe générique), dans la même veine que `lib/application-adapter.ts`.
- **Créer** : un hook de chargement des liens d'une application, dans la même veine que `lib/useApplications.ts`.
- **Créer** : le **composant générique de diagramme en étoile** dans `components/` (réutilisable, sans dépendance au domaine application).
- **Créer** : le composant de panneau d'onglet In Context — c'est lui qui porte le fetch, l'adaptation du DTO et la navigation vers `/application?id=<externalId>`, et qui consomme le composant générique.
- **Modifier** : le composant d'onglets de la fiche application (issu de `onglets-fiche-application-identity.md`) — remplacement du placeholder In Context.
- **Non touché** : `lib/application-adapter.ts`, `components/Gallery.tsx`, catalogue, `/map`, export PDF, `app/error.tsx`.

## Dépendances
- Cette spec **suppose implémentée** la structure d'onglets décrite dans `onglets-fiche-application-identity.md` (barre de 5 onglets + panneaux). Tant que celle-ci n'est pas en place, l'onglet In Context n'a pas de point d'accroche.

## Edge Cases
- **Aucun lien** (`[]`) → état vide explicite ("Aucune application liée"), pas de diagramme vide ni de nœud central isolé.
- **Un seul lien** → étoile à un branche ; le layout doit rester correct pour `n = 1`.
- **Beaucoup de liens** (> 12) → bascule automatique en deux anneaux concentriques ; au-delà de ~30 voisins la lisibilité se dégrade mais le rendu ne doit ni déborder du conteneur ni provoquer de chevauchement de nœuds.
- **Doublon** : normalement impossible (fusion faite par l'API). Si l'API en renvoie un malgré tout → les deux entrées sont affichées comme deux nœuds distincts, sans fusion silencieuse.
- **Auto-référence** : l'application courante présente dans sa propre liste de liens → l'entrée est ignorée.
- **`direction` inconnu ou absent** (valeur hors `inbound` / `outbound` / `both`) → arête sans flèche, nœud conservé.
- **`name` vide ou `null`** sur un voisin → repli sur l'`externalId` comme libellé.
- **Nom très long** → tronqué avec ellipse dans le nœud, nom complet disponible en `title`/tooltip.
- **Étiquettes en haut/bas de l'étoile** → l'ancrage du texte doit dépendre du secteur angulaire pour éviter les chevauchements avec le nœud central et entre voisins voisins.
- **Erreur réseau / 404 sur `/links`** → message d'erreur localisé dans le panneau, avec possibilité de réessayer ; le reste de la fiche reste intact.
- **Backend indisponible** → même traitement que ci-dessus, sans bascule vers l'écran d'erreur global.

## Open Questions
_Toutes les questions ouvertes de la première rédaction ont été tranchées et intégrées ci-dessus :_
- **Valeurs de `direction`** → `inbound`, `outbound`, `both` ; la bidirectionnalité est explicite côté API.
- **Volumétrie** → ~30 liens au maximum ; couvert par les deux anneaux, pan/zoom non nécessaire.
- **Cardinalité multiple** → fusion déjà effectuée par l'API ; pas de déduplication côté frontend, un doublon éventuel est affiché deux fois.

## Acceptance Criteria
- [ ] L'onglet In Context de `/application?id=<externalId>` affiche une étoile centrée sur l'application courante, entourée de ses applications liées.
- [ ] Les liens sont chargés depuis `/api/infos/applications/{externalId}/links` à la première ouverture de l'onglet, pas au chargement de la fiche.
- [ ] Une relation entrante, sortante et bidirectionnelle se distinguent visuellement par le fléchage de l'arête, documenté par une légende.
- [ ] Une entrée `direction: "both"` est rendue avec une arête à double flèche.
- [ ] Cliquer un nœud voisin ouvre la fiche de cette application.
- [ ] Au-delà de 12 voisins, le diagramme passe automatiquement en deux anneaux concentriques sans chevauchement de nœuds.
- [ ] Les états chargement / vide / erreur sont couverts et confinés au panneau de l'onglet.
- [ ] Le diagramme est lisible en thème clair et en thème sombre, sans couleur codée en dur.
- [ ] Le composant de diagramme est générique : aucun import de `Application`, aucun fetch, aucun hook de routing à l'intérieur ; il est instanciable depuis une autre page avec un simple jeu `{ center, neighbors }`.
- [ ] Aucune dépendance npm ajoutée.
- [ ] Build Next OK (`npm run build`).
