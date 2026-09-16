# Feature Spec: Transport hybride du seed Discover — URL courte ou relais `localStorage`

## Summary
- « Show in Discover » transmet aujourd'hui **tous** les ids d'applications dans l'URL (`/discover/?ids=<uuid>,<uuid>,…`). Chaque id est un UUID LeanIX de 36 caractères, soit ~37 octets par application : au-delà d'environ 200 applications, la requête dépasse les tampons d'en-tête de la passerelle (nginx : 8 Ko → **414 URI Too Long**) ou du serveur Node (16 Ko → **431**), et l'onglet n'affiche pas l'application du tout.
- Introduire un **transport hybride**, avec le seuil déjà en place (`SEED_CONFIRM_THRESHOLD` = 25) comme point de bascule :
  - **≤ 25 applications** → comportement actuel inchangé, `?ids=…` dans l'URL : lien court, lisible et **réellement partageable**.
  - **> 25 applications** → les ids sont déposés dans le **`localStorage`** sous une clé jetable, et l'URL ne porte plus qu'un jeton : `/discover/?seed=<token>`, de quelques dizaines d'octets.
- Discover accepte les **deux** formes en lecture ; le mode jeton consomme puis efface son entrée.

## Motivation
- La limite n'est pas un confort d'affichage mais un **échec dur d'infrastructure** : l'utilisateur n'obtient pas un graphe dense, il obtient une page d'erreur de la passerelle, sans message exploitable.
- La spec `_specification/vibe coding/popup-warning-show-in-discover-au-dela-du-seuil.md` a supprimé le plafond `SEED_MAX` (100) pour permettre à l'utilisateur de passer outre l'avertissement. Ce plafond servait justement de garde-fou implicite contre la longueur d'URL : sans lui, le cas 414/431 devient atteignable. Cette spec ferme ce trou.
- Le seuil de bascule n'a pas besoin d'être inventé : à 25, on a déjà la frontière entre « ouverture directe » et « avertissement ». Les deux comportements coïncident naturellement — petite sélection = lien partageable direct, grande sélection = avertissement + relais local.

## Décisions (arbitrées)

### Pourquoi `localStorage` et non `sessionStorage`
- Un onglet ouvert avec `rel="noopener"` / `window.open(..., "noopener")` — ce que fait le code actuel des deux côtés — **n'hérite pas** du `sessionStorage` de l'onglet ouvrant : la copie n'a lieu que pour un contexte auxiliaire, et `noopener` en crée précisément un détaché.
- `localStorage` est partagé entre tous les onglets de la même origine, donc insensible à ce point. Il est retenu, et `noopener`/`noreferrer` sont **conservés** (on ne rouvre pas un `window.opener` sur le catalogue pour contourner le problème).
- Volume : 400 UUID ≈ 15 Ko contre ~5 Mo de quota — non contraignant.

### Cycle de vie de l'entrée
- Le catalogue écrit, sous une clé préfixée et un jeton aléatoire, la liste d'ids accompagnée d'un horodatage de création.
- Discover lit l'entrée au montage, l'utilise pour amorcer la sélection, puis la **supprime** immédiatement : un jeton est à usage unique.
- À cette occasion, Discover purge aussi les entrées périmées (ancienneté au-delà de quelques minutes) laissées par des ouvertures abandonnées.

### Compatibilité et repli
- La forme `?ids=…` reste **supportée en lecture** quelle que soit sa longueur : les liens déjà partagés, les URL écrites à la main et les petites sélections continuent de fonctionner à l'identique.
- Si le `localStorage` est indisponible (navigation privée restrictive, stockage bloqué), l'écriture échoue silencieusement : on retombe sur l'URL `?ids=…`, quitte à risquer le 414 — un lien trop long reste préférable à une action sans effet.

### Lien partagé et expiration
- Un lien `?seed=<token>` n'est **pas partageable** : collé dans un message ou ouvert sur une autre machine, il ne résout rien. C'est le compromis assumé pour les grandes sélections ; les petites (le cas où l'on partage réellement) gardent l'URL explicite.
- Jeton absent, déjà consommé ou périmé → un message explicite (« ce lien a expiré, relancez depuis le catalogue ») plutôt qu'un graphe vide inexpliqué.

## Requirements

### Functional Requirements
- Le catalogue choisit le transport selon le nombre d'applications filtrées : URL `?ids=` jusqu'à 25 inclus, relais `localStorage` + `?seed=` au-delà.
- L'URL en mode jeton reste courte et de longueur constante, quel que soit le nombre d'applications.
- Discover amorce sa sélection à partir de l'une ou l'autre forme, avec un résultat fonctionnellement identique.
- L'entrée de `localStorage` est supprimée dès sa lecture ; les entrées périmées sont purgées.
- Un jeton introuvable ou expiré produit un message clair, distinct du bandeau existant « N applications from this link could not be shown » (qui, lui, signale des ids non résolus).
- L'avertissement au-delà de 25 applications (modale « Continue » / « Cancel ») reste en place et inchangé.

### Non-Functional Requirements
- `noopener`/`noreferrer` conservés sur l'ouverture du nouvel onglet.
- `basePath` : l'URL doit continuer d'être produite via `next/link` (ou l'href résolu de l'ancre), jamais reconstruite à la main — sinon 404 derrière la passerelle AFTER.
- Tout accès au stockage est protégé : un `localStorage` indisponible ou en quota dépassé ne doit jamais casser le catalogue ni Discover.
- Aucun appel réseau supplémentaire, aucune nouvelle dépendance.
- Les ids restent les ids techniques LeanIX, seule clé d'identification du graphe.

## Scope

### In Scope
- Écriture/lecture/suppression du seed dans `localStorage`, avec jeton et horodatage.
- Choix du transport côté catalogue selon le seuil.
- Lecture des deux formes côté Discover, purge des entrées périmées.
- Message d'expiration/jeton introuvable.

### Out of Scope
- Performances de rendu du graphe pour les grandes sélections (parallélisme des requêtes GraphQL, coût d'ELK, densité du canvas) — sujet distinct, à mesurer en conditions réelles.
- Réintroduction d'un plafond dur sur le nombre d'applications.
- Persistance de la sélection Discover après exploration (le seed reste lu une seule fois).
- Partage de grandes sélections entre utilisateurs (nécessiterait un stockage serveur).

## Affected Areas
- **Modifier** : `lib/discoverSeed.ts` — point unique où vivent la grammaire d'URL et les seuils ; y ajouter l'écriture/lecture/purge du relais et le choix de transport.
- **Modifier** : `components/CatalogueClient.tsx` — construction du href selon le transport, avant l'ouverture de l'onglet et avant la modale d'avertissement.
- **Modifier** : `components/DiscoverClient.tsx` — lecture de `?seed=` en plus de `?ids=`, et affichage du message d'expiration.
- **Non touché** : `components/CatalogueActions.tsx` (il reçoit un href, sans savoir d'où il vient), `components/discover/DiscoverGraph.tsx`, la logique d'export PDF.

## Edge Cases
- **Exactement 25 applications** → transport URL (le seuil est « au-delà de 25 » pour basculer, cohérent avec le seuil d'avertissement).
- **`localStorage` indisponible ou plein** → repli sur `?ids=`, sans erreur visible.
- **Jeton déjà consommé** (rechargement de l'onglet Discover, retour arrière) → message d'expiration ; le graphe ne se réamorce pas silencieusement à vide.
- **Lien `?seed=` ouvert sur une autre machine ou après plusieurs jours** → même message d'expiration.
- **URL portant à la fois `?ids=` et `?seed=`** (cas construit à la main) → une règle de priorité déterministe, documentée (le jeton l'emporte, ou l'inverse — à trancher au plan).
- **Ancien lien `?ids=` très long déjà partagé** → continue de fonctionner tant que la passerelle l'accepte ; sinon, échec côté infrastructure comme aujourd'hui, hors de portée du code.
- **Deux ouvertures successives depuis le catalogue** → deux jetons distincts, aucune collision.

## Open Questions
- **Durée de validité** du jeton : quelques minutes suffisent-elles, ou faut-il tolérer qu'un utilisateur rouvre l'onglet plus tard dans la journée ? => 30 minutes suffisent

- **Priorité `?seed=` vs `?ids=`** si les deux sont présents. => priorité à @ids

- **Seuil de bascule** : faut-il le garder strictement aligné sur `SEED_CONFIRM_THRESHOLD` (25), ou le découpler pour pouvoir ajuster l'avertissement sans changer le transport ? => aligné

## Acceptance Criteria
- [ ] Jusqu'à 25 applications, l'URL reste `/discover/?ids=…`, identique à aujourd'hui.
- [ ] Au-delà, l'URL est `/discover/?seed=<token>`, de longueur constante, et le graphe reçoit exactement les mêmes applications.
- [ ] Une sélection de plusieurs centaines d'applications s'ouvre sans erreur 414/431.
- [ ] L'entrée de `localStorage` est supprimée après lecture, et les entrées périmées sont purgées.
- [ ] Un jeton absent ou expiré affiche un message explicite, distinct du bandeau d'ids non résolus.
- [ ] `noopener`/`noreferrer` et la résolution du `basePath` sont préservés.
- [ ] Un `localStorage` indisponible ne casse ni le catalogue ni Discover.
- [ ] Build Next OK, aucune régression sur l'avertissement « Continue / Cancel » ni sur l'export PDF.
