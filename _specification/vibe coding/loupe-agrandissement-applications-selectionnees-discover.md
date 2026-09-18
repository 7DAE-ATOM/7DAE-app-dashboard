# Feature Spec: Loupe d'agrandissement — Applications sélectionnées (Discover)

## Summary
- Dans la vue Discover, la barre des applications sélectionnées (`components/discover/SelectedApplicationsBar.tsx`) est une bande de chips de hauteur fixe et de largeur contrainte, placée dans la barre d'outils du haut. Dès qu'une dizaine d'applications sont sélectionnées, la liste devient un petit ascenseur difficile à lire.
- Ajouter une **icône loupe** dans cette barre, qui ouvre une **modale** affichant la même liste d'applications sélectionnées, en grand : beaucoup plus d'espace, toutes les chips visibles sans scroll serré.
- La modale reste pleinement fonctionnelle : on peut y retirer une application (même action que dans la barre), et le graphe se met à jour immédiatement derrière.

## Motivation
- La barre est aujourd'hui dimensionnée en `h-10` avec `max-w-xl` et `overflow-y-auto` : au-delà de 3–4 chips, l'utilisateur doit scroller dans une zone de 40 px de haut pour savoir ce qu'il a sélectionné, et retirer une application devient un exercice de précision.
- Discover est précisément la vue où l'on empile plusieurs applications pour comparer leurs dépendances — le cas « beaucoup d'applications » est le cas nominal, pas un cas limite.
- Le pattern de modale existe déjà dans le codebase (`components/AboutDialog.tsx` : overlay `fixed inset-0`, `role="dialog"`, `aria-modal`, fermeture par Échap / clic sur l'overlay / bouton croix) — la feature réutilise ce pattern plutôt que d'introduire une librairie ou une nouvelle mécanique.

## Décisions (arbitrées)

### Périmètre visuel
- La feature concerne **la barre des chips d'applications sélectionnées**, pas le canvas du graphe. Agrandir/zoomer le graphe lui-même est un sujet distinct (le graphe a déjà ses propres contrôles).

### Emplacement et forme du déclencheur
- Une icône loupe discrète, intégrée à la barre des chips (bord droit, ou accolée à la barre dans la toolbar), au même niveau visuel que les autres contrôles de la toolbar Discover.
- Elle n'apparaît que lorsqu'il y a au moins une application sélectionnée — la barre elle-même est déjà masquée quand la sélection est vide (`if (applications.length === 0) return null`). Le comportement « rien de sélectionné → rien d'affiché » est préservé.

### Contenu de la modale
- Même jeu de données que la barre : les applications sélectionnées, par leur nom, avec leur bouton de retrait.
- Disposition aérée : chips plus grandes, réparties sur toute la largeur de la modale, avec défilement uniquement si la sélection dépasse la hauteur disponible.
- La modale est un **agrandissement**, pas une nouvelle fonctionnalité : pas de tri, pas de recherche, pas de sélection multiple, pas d'ajout d'application depuis la modale (l'ajout reste le rôle d'`ApplicationSearch`).

### Synchronisation
- La modale lit la même source de vérité que la barre (l'état `selected` de `DiscoverClient`) et appelle le même `onRemove`. Retirer une application depuis la modale la retire de la barre et du graphe simultanément.
- Retirer la dernière application depuis la modale : voir Edge Cases.

## Requirements

### Functional Requirements
- La barre des applications sélectionnées expose une icône loupe (avec `aria-label` et `title` explicites, ex. « Agrandir la liste des applications sélectionnées »).
- Un clic sur la loupe ouvre une modale listant toutes les applications sélectionnées.
- La modale se ferme par : clic sur le bouton de fermeture, touche `Échap`, clic sur l'overlay — cohérent avec `AboutDialog`.
- Chaque entrée de la modale porte un bouton de retrait qui déclenche la même action que dans la barre compacte.
- La modale affiche le nombre d'applications sélectionnées dans son titre (ex. « Applications sélectionnées (12) »).

### Non-Functional Requirements
- **Aucun appel réseau** : la modale n'affiche que des données déjà en mémoire côté client.
- **Réutilisation du pattern existant** : structure d'overlay/dialogue calquée sur `components/AboutDialog.tsx`, tokens de couleur du thème (`bg-surface`, `border-border`, `text-fg`, `text-muted`) pour rester correct en mode clair **et** sombre.
- **Accessibilité** : `role="dialog"` + `aria-modal="true"` + titre associé, focus déplacé sur le bouton de fermeture à l'ouverture, gestion de `Échap`.
- **Pas de régression** sur la barre compacte : elle conserve son comportement actuel quand la modale est fermée.
- **Client component** : la modale vit dans l'arbre client de Discover (`DiscoverClient` est déjà `"use client"`), conformément à la règle de frontière client/serveur du projet.

## Scope

### In Scope
- Icône loupe dans la barre des applications sélectionnées.
- Modale d'agrandissement listant les applications sélectionnées avec retrait possible.
- États d'ouverture/fermeture, accessibilité clavier, thème clair/sombre.

### Out of Scope
- Zoom / plein écran du canvas du graphe Discover.
- Recherche, tri ou filtrage à l'intérieur de la modale.
- Ajout d'applications depuis la modale.
- Actions supplémentaires par application (ouvrir la fiche, centrer sur le nœud, etc.) — envisageable ultérieurement, non couvert ici.
- Persistance de l'état d'ouverture de la modale entre navigations.

## Affected Areas
- **Modifier** : `components/discover/SelectedApplicationsBar.tsx` — ajout du déclencheur loupe et de l'état d'ouverture.
- **Créer** : un composant de modale dédié sous `components/discover/` (ex. `SelectedApplicationsDialog.tsx`), pour ne pas gonfler la barre.
- **Éventuellement modifier** : `components/DiscoverClient.tsx` — uniquement si la modale doit être montée à ce niveau plutôt que depuis la barre.
- **Référence (non modifié)** : `components/AboutDialog.tsx` — pattern de modale à répliquer.
- **Non touché** : `components/discover/DiscoverGraph.tsx`, `ApplicationSearch.tsx`, `DiscoverDisplaySettings.tsx`, `ApplicationInfoCard.tsx`.

## Edge Cases
- Sélection vide → ni barre ni loupe (comportement actuel conservé).
- Une seule application sélectionnée → la loupe reste disponible (cohérence), même si l'agrandissement apporte peu.
- Retrait de la **dernière** application depuis la modale → la sélection devient vide : la modale se ferme automatiquement, plutôt que de laisser une modale vide ouverte au-dessus d'un graphe vide.
- Très grand nombre d'applications (plusieurs dizaines) → la modale défile verticalement, avec une hauteur maximale bornée pour ne pas dépasser la fenêtre.
- Noms d'application très longs → la chip s'adapte sans casser la mise en page (retour à la ligne ou troncature lisible).
- Interaction avec le graphe pendant que la modale est ouverte → la modale est modale : le graphe n'est pas manipulable tant qu'elle est ouverte, ce qui est acceptable puisqu'elle sert à faire le point sur la sélection.

## Open Questions
- **Cible de l'agrandissement** : cette spec suppose qu'il s'agit de la barre des chips d'applications sélectionnées. S'il s'agissait en réalité d'agrandir le **graphe** Discover lui-même, la feature change de nature — à confirmer. => oui que la barre de chips

- **Emplacement exact de la loupe** : à l'intérieur de la barre (coin droit, flottant au-dessus des chips) ou à côté de la barre dans la toolbar ? La première option garde le lien visuel, la seconde évite de recouvrir une chip. => interieur de la barre

- **Actions dans la modale** : se limiter au retrait, ou en profiter pour offrir un lien vers la fiche de l'application (`/application?id=<externalId>`) ? Non retenu dans cette itération, à trancher si le besoin se confirme. => uniquement le retrait

## Acceptance Criteria
- [ ] Une icône loupe est visible dans la barre des applications sélectionnées dès qu'au moins une application est sélectionnée.
- [ ] Un clic sur la loupe ouvre une modale listant toutes les applications sélectionnées, avec leur nombre dans le titre.
- [ ] La modale se ferme par bouton de fermeture, `Échap` et clic sur l'overlay.
- [ ] Le retrait d'une application depuis la modale met à jour simultanément la barre compacte et le graphe.
- [ ] Le retrait de la dernière application ferme automatiquement la modale.
- [ ] Le rendu est correct en thème clair et en thème sombre, sans couleur codée en dur hors tokens.
- [ ] Aucun appel réseau supplémentaire.
- [ ] Build Next OK, pas de régression sur la barre compacte ni sur le reste de la vue Discover.
