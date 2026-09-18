# Feature Spec: Indicateur de complétion en anneau SVG

## Summary
- Remplacer l'affichage textuel du taux de complétion d'une application (`96%` dans une `StatCard`) par un **anneau de progression** : un cercle plus ou moins rempli selon le pourcentage, avec la **valeur au centre**.
- Le rendu est un **composant SVG dédié, générique et réutilisable**, écrit à la main — pas de bibliothèque de graphiques, pas de dépendance npm nouvelle.
- **Un seul anneau.** Le prototype artefact affiche un widget à *deux* anneaux concentriques (complétion + « Quality Seal ») ; le Quality Seal est explicitement **hors périmètre** — il n'existe pas dans le DTO backend et n'a pas à être inventé.

## Motivation
- `completion` est une valeur bornée 0–100 : c'est exactement le cas où une forme vaut mieux qu'un nombre. Un anneau se lit d'un coup d'œil, sans lire le chiffre, et permet de comparer deux applications instantanément.
- Aujourd'hui la valeur est noyée parmi les autres `StatCard` de l'onglet Accountability (Portfolio, Operator, Provider Type…), toutes des chaînes de caractères. Rien ne signale qu'il s'agit d'une mesure.
- Le repo a déjà fait le choix du SVG inline maison pour le diagramme en étoile (`onglet-in-context-diagramme-etoile-liens-applications.md`) : un anneau de progression est un cas encore plus simple (un arc, un texte), la cohérence technique est immédiate.

## Décisions (arbitrées)
- **Composant générique et réutilisable** : il prend une valeur et un maximum, et ne connaît rien au domaine « application ». Aucun appel réseau, aucun accès au type `Application`. Rangé dans `components/` à la racine, comme `StarGraph`, pour signaler son statut de composant partagé.
- **Anneau unique**, alimenté par le seul champ `completion`. Pas de Quality Seal, pas de second anneau.
- **Pourcentage au centre**, en chiffres, dans la police du repo. C'est le point où l'anneau et la valeur exacte se lisent ensemble.
- **Couleurs par les tokens `--color-*`** uniquement : piste de fond en `--color-border`, arc rempli en `--color-accent`, texte en `--color-fg`. Adaptation clair/sombre sans JavaScript.
- **Départ à midi, sens horaire** : convention universelle des jauges circulaires.
- **Taille pilotée par l'appelant** via une prop, avec une valeur par défaut adaptée à l'usage en `StatCard`. Le tracé s'adapte proportionnellement (épaisseur d'anneau, taille de police) plutôt que d'être figé à une seule dimension.
- **Pas d'animation** dans cette itération : la valeur est statique une fois la fiche chargée.

## Requirements

### Functional Requirements
- L'onglet Accountability de la fiche `/application?id=<externalId>` affiche la complétion sous forme d'anneau, à la place de la valeur textuelle actuelle.
- L'arc rempli est proportionnel au pourcentage : 0 % laisse l'anneau vide (seule la piste de fond est visible), 100 % le remplit entièrement.
- Le pourcentage est écrit au centre de l'anneau.
- L'anneau reste lisible dans les deux thèmes, sans couleur codée en dur.
- Le composant est utilisable ailleurs dans l'application en lui passant une valeur, un maximum et une taille, sans dépendance à la fiche application.
- Une valeur hors bornes est ramenée dans l'intervalle affichable plutôt que de produire un tracé incohérent.

### Non-Functional Requirements
- **Aucune dépendance npm nouvelle** : SVG inline + tokens CSS existants.
- **Pas de `"use client"` nécessaire** : le composant est purement présentationnel, sans état ni API navigateur — il doit pouvoir être rendu côté serveur comme les icônes de `components/icons/`.
- **Accessibilité** : la valeur doit rester perceptible par un lecteur d'écran, l'anneau étant décoratif par rapport au chiffre.
- **Cohérence visuelle** avec les encarts existants : l'anneau s'insère dans la grille de `StatCard` sans casser l'alignement des autres cartes de la rangée.

## Scope

### In Scope
- Le composant générique d'anneau de progression (SVG inline, réutilisable).
- Son intégration dans l'onglet Accountability, en remplacement de la `StatCard` textuelle « Completion ».

### Out of Scope
- **Le Quality Seal et le second anneau** du prototype artefact : la donnée n'existe pas côté backend.
- **Animation** de remplissage à l'apparition.
- **Seuils colorés** (vert / orange / rouge selon le niveau de complétion) — voir Open Questions.
- **La carte du catalogue** (`ApplicationCard`, qui affiche `96%` en mono) et **l'export PDF** (`components/pdf/ApplicationDetailPage.tsx`) — voir Open Questions.
- Toute interaction : l'anneau n'est ni cliquable ni survolable.

## Affected Areas
- **Créer** : le composant d'anneau de progression, dans `components/` à la racine (composant partagé, comme `StarGraph.tsx`).
- **Modifier** : `components/detail/AccountabilityTab.tsx` — remplacement de la `StatCard` « Completion » par le nouvel affichage.
- **Éventuellement modifier** : `components/detail/StatCard.tsx`, si l'anneau doit s'insérer *dans* une carte plutôt que de s'y substituer (voir Open Questions).
- **Non touché** : `lib/types.ts`, `lib/application-adapter.ts`, `lib/atom-api.ts` (le champ `completion` existe déjà), `components/ApplicationCard.tsx`, `components/pdf/*`, catalogue, `/map`.

## Edge Cases
- **`completion = 0`** → anneau entièrement vide, piste de fond visible, « 0% » au centre. L'indicateur ne doit pas disparaître.
- **`completion = 100`** → anneau plein, sans artefact visuel à la jonction du début et de la fin de l'arc.
- **Valeur négative ou supérieure à 100** (donnée backend incohérente) → ramenée dans l'intervalle 0–100 pour le tracé ; à arbitrer si le chiffre affiché doit être la valeur brute ou la valeur bornée.
- **Valeur non entière** → arrondi pour l'affichage, l'arc restant calculé sur la valeur exacte.
- **Très petite taille** → le pourcentage central doit rester lisible ou être masqué, plutôt que déborder de l'anneau.

## Open Questions
- **Insertion dans la grille** : l'anneau remplace-t-il entièrement la `StatCard` « Completion » (un anneau nu dans la rangée), ou reste-t-il dans une `StatCard` avec son libellé et son icône, l'anneau prenant la place de la valeur ? La seconde option préserve l'alignement de la rangée mais donne une carte plus haute que les autres. => on supprime la statCard completion et ce nouveau diagramme sera affiche sous le cycle de vie de la page principale

- **Couleur selon le niveau** : arc toujours en `--color-accent`, ou coloré par seuils (`--color-success` / `--color-warning` / `--color-danger`) comme le fait le prototype pour son Quality Seal ? Un code couleur suppose des seuils métier qui ne sont documentés nulle part. => non pas de code couleur pour l'instant

- **Propagation aux autres surfaces** : faut-il aussi remplacer le `96%` textuel de la carte catalogue (`ApplicationCard`) par une version miniature de l'anneau, et adapter l'export PDF ? L'export PDF utilise `@react-pdf/renderer`, qui ne rend pas le SVG du DOM — il faudrait un tracé équivalent dans son propre langage. => pas d'impact

- **Libellé central** : uniquement le pourcentage (`96%`), ou le chiffre seul avec le mot « Completion » sous l'anneau ? => pourcentage et mot completion

## Acceptance Criteria
- [ ] L'onglet Accountability affiche la complétion sous forme d'un anneau dont le remplissage correspond au pourcentage, avec la valeur au centre.
- [ ] L'anneau est rendu par un composant dédié qui n'importe ni `Application`, ni aucun hook de données, et qui est instanciable ailleurs avec une simple valeur.
- [ ] 0 % et 100 % s'affichent correctement, sans anneau invisible ni jonction visible.
- [ ] Aucune couleur codée en dur : rendu correct en thème clair et en thème sombre.
- [ ] La valeur reste accessible aux lecteurs d'écran.
- [ ] Aucune dépendance npm ajoutée.
- [ ] Build Next OK (`npm run build`).
