# Feature Spec: Actions rapides (Export PDF / Show in Discover) en tête du panneau de filtres

## Summary
- Sortir les deux boutons d'action **"Export PDF"** et **"Show in Discover"** de leur position actuelle (tout en bas de la colonne de filtres du catalogue, `components/CatalogueClient.tsx`) et les regrouper sous une nouvelle rangée **"ACTIONS"** placée en haut du panneau de filtres, avant la liste des chapitres de filtre.
- Ces deux actions deviennent des **boutons icône** (avec info-bulle/label explicite), plutôt que des boutons pleine largeur avec texte complet.

## Motivation
- Le panneau de filtres (`FilterBar`) peut contenir plusieurs chapitres (Catégorie, Statut, Portfolio, Criticité métier, Photo, …) ; sur une liste de filtres longue, les boutons "Export PDF" et "Show in Discover" — actuellement positionnés après tous les chapitres — sortent facilement de la zone visible du panneau sticky, malgré leur utilité fréquente.
- Les remonter en tête de panneau, sous un intitulé "ACTIONS" dédié, garantit leur visibilité permanente, indépendamment du nombre de chapitres de filtre affichés.
- Le passage à des boutons icône (au lieu de texte pleine largeur) réduit l'espace occupé par ces actions tout en gardant leur clarté via une info-bulle et/ou un court libellé.

## Décisions (arbitrées)
- **Emplacement** : une rangée "ACTIONS" en haut du panneau de filtres, avant tout chapitre de filtre — pas rattachée à un chapitre existant (ex. "Photo"), pour ne pas mélanger une action avec un filtre.
- **Forme** : deux boutons icône côte à côte, avec une info-bulle (`title`) reprenant le libellé complet actuel ("Export PDF", "Show in Discover").
- **Compteur** : le nombre d'applications concernées (actuellement affiché en toutes lettres, ex. "Export PDF (12)") doit rester visible sous une forme compacte (ex. petit badge numérique sur l'icône) plutôt que disparaître.

## Requirements

### Functional Requirements
- Une rangée "ACTIONS" est affichée en haut du panneau de filtres du catalogue, avant les chapitres de filtre existants.
- Elle contient deux boutons icône : un pour "Export PDF", un pour "Show in Discover".
- Chaque bouton affiche, au minimum au survol, son libellé complet actuel.
- Chaque bouton continue de refléter le nombre d'applications actuellement filtrées (visible en toutes lettres aujourd'hui) sous une forme compacte.
- Le comportement fonctionnel de chaque action (génération du PDF, ouverture de Discover avec les ids filtrés) reste strictement identique à l'existant — seul l'emplacement et la présentation visuelle changent.
- Les états déjà gérés aujourd'hui (aucune application visible → action désactivée ; génération PDF en cours → état "Generating…") restent representés d'une manière ou d'une autre sur la nouvelle présentation icône.

### Non-Functional Requirements
- Aucune régression sur le comportement d'export PDF ni sur le lien "Show in Discover" (ids transmis, ouverture dans un nouvel onglet).
- Cohérence visuelle avec les tokens `--color-*` existants, lisible en thème clair et sombre.
- Le panneau de filtres mobile (`FilterSheet`) reste cohérent avec ce changement (à trancher : même traitement icône, ou conservation de la présentation actuelle en texte, cf. Open Questions).

## Scope

### In Scope
- Déplacement visuel des deux actions existantes vers une nouvelle rangée "ACTIONS" en haut du panneau de filtres desktop (`FilterBar`/`CatalogueClient`).
- Passage de ces deux actions à une présentation en boutons icône avec info-bulle et compteur compact.

### Out of Scope
- Ajout de nouvelles actions au-delà des deux existantes.
- Modification de la logique métier d'export PDF ou de construction du lien Discover.
- Refonte plus large de la structure du panneau de filtres au-delà de l'ajout de cette rangée.

## Affected Areas
- **Modifier** : `components/CatalogueClient.tsx` (positionnement actuel des deux boutons, logique `handleExportPdf`/`handleShowInDiscover` réutilisée telle quelle).
- **Modifier éventuellement** : `components/FilterBar.tsx` (si la rangée "ACTIONS" doit vivre à l'intérieur du composant de filtres plutôt qu'au-dessus, à trancher au plan).
- **À vérifier** : `components/FilterSheet.tsx` (version mobile du panneau de filtres) pour cohérence, si les actions y sont également exposées.
- **Non touché** : la logique d'export PDF elle-même, la construction de l'URL Discover (`buildDiscoverSeedHref`), le reste du catalogue (cartes, pagination).

## Edge Cases
- **Aucune application ne correspond aux filtres actuels** → le bouton "Export PDF" et le bouton "Show in Discover" doivent rester visuellement désactivés, comme aujourd'hui (actuellement un bouton `disabled` réel pour Discover à 0 résultat, pas un lien mort).
- **Export PDF en cours de génération** → l'état "Generating…" actuellement affiché en toutes lettres doit rester perceptible sur la version icône (ex. icône de chargement), pas seulement disparaître silencieusement.
- **Compteur à deux ou trois chiffres** (ex. plus de 99 applications) → le badge compact doit rester lisible sans déformer le bouton icône.

## Open Questions
- Les boutons icône doivent-ils porter un **court libellé texte à côté de l'icône** (ex. "PDF", "Discover"), ou rester **icône seule** avec info-bulle uniquement au survol ? => icone seule

- Le compteur doit-il être un **badge numérique superposé** à l'icône, ou un **petit texte à côté** de l'icône ? => badge numérique superposé 

- Sur le panneau de filtres **mobile** (`FilterSheet`), applique-t-on la même présentation icône, ou conserve-t-on les boutons texte actuels (l'espace horizontal y est différent) ? => meme présentation icone

- La rangée "ACTIONS" doit-elle rester **visible en permanence** (sticky avec le reste du panneau), comme c'est déjà le cas aujourd'hui pour la colonne de filtres entière ? => oui

## Acceptance Criteria
- [ ] Une rangée "ACTIONS" avec deux boutons icône (Export PDF, Show in Discover) est visible en haut du panneau de filtres, avant tout chapitre de filtre.
- [ ] Chaque bouton affiche son libellé complet au survol et reste utilisable au clavier (accessible).
- [ ] Le nombre d'applications concernées reste visible sous une forme compacte sur chaque bouton.
- [ ] Le comportement d'export PDF et d'ouverture de Discover reste strictement identique à l'existant.
- [ ] Les états désactivé (aucune application) et "génération en cours" restent perceptibles sur la nouvelle présentation.
- [ ] Build Next OK (`npm run build`).
