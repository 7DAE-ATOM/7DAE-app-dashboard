# Feature Spec: Boutons d'actions ronds avec info-bulle porteuse du compteur

## Summary
- Aligner la rangée « ACTIONS » du panneau de filtres (`components/CatalogueActions.tsx`) sur la maquette fournie (`temp/action.jpg`) : deux **boutons ronds** clairs, nettement plus grands que les boutons carrés actuels, portant un **pictogramme plein** centré.
- Le **compteur d'applications n'est plus un badge superposé** : il est porté par l'**info-bulle**, qui devient une bulle sombre arrondie avec flèche (« Export PDF (408) »), au lieu de l'info-bulle native du navigateur.
- Les deux pictogrammes changent : un **document « PDF »** (feuille avec le sigle PDF) pour l'export, une **icône de partage/réseau** (un nœud à gauche relié à deux nœuds à droite) pour « Show in Discover ».
- L'intitulé « ACTIONS » reste au-dessus, en majuscules espacées, mais dans une graisse/taille plus affirmée que les titres de chapitre de filtre.

## Motivation
- L'itération précédente (`_specification/vibe coding/actions-rapides-export-pdf-discover-en-tete-filtres.md`) a bien remonté les deux actions en tête du panneau, mais avec un rendu carré bordé + badge numérique qui ne correspond pas à l'intention visuelle : la maquette montre des pastilles rondes lisibles au premier coup d'œil, sans surcharge chiffrée collée à l'icône.
- Le badge superposé posait par ailleurs un problème de lisibilité dès trois chiffres (repli « 99+ » qui masque l'information exacte). Déplacer le compte dans l'info-bulle le rend **exact** quel que soit le nombre (« Export PDF (408) » dans la maquette).
- Une info-bulle stylée garantit un rendu identique sur tous les navigateurs et en thème sombre, là où l'attribut `title` natif est lent à apparaître et non stylable.

## Décisions (arbitrées)

### Forme des boutons
- Boutons **circulaires**, fond clair uni, sans bordure visible (ou bordure très discrète), avec un léger relief/ombre pour les détacher du fond du panneau.
- Diamètre sensiblement supérieur à l'actuel (≈ 44 px contre 36 px), pictogramme centré d'environ 20–22 px.
- Les deux boutons restent côte à côte, alignés à gauche, avec un espacement confortable.

### Pictogrammes
- **Export PDF** : feuille de document au coin replié, avec le sigle « PDF » lisible à l'intérieur, en aplat plein (pas en trait fin).
- **Show in Discover** : icône de partage/réseau — un nœud à gauche relié par deux segments à deux nœuds à droite (haut et bas), en aplat plein.
- Les pictogrammes sont **pleins** (fill), pas en contour, conformément à la maquette.

### Info-bulle
- Bulle sombre à coins arrondis, texte clair, petite flèche pointant vers le bouton, affichée **sous** le bouton au survol et au focus clavier.
- Contenu : le libellé complet **avec le compteur exact** entre parenthèses — « Export PDF (408) », « Show in Discover (408) ».
- Elle remplace le badge numérique superposé, qui disparaît complètement.

### États
- **Aucune application filtrée** : les deux boutons restent visuellement désactivés (opacité réduite, curseur interdit) ; l'info-bulle indique le libellé avec « (0) ».
- **Export en cours** : le pictogramme PDF est remplacé par un indicateur d'activité (rotation), l'info-bulle indique « Generating PDF… ».

## Requirements

### Functional Requirements
- Les deux actions sont rendues comme des boutons ronds clairs à pictogramme plein, selon la maquette `temp/action.jpg`.
- Aucun badge numérique n'est superposé aux boutons.
- Au survol **et au focus clavier**, une info-bulle stylée affiche le libellé complet suivi du nombre exact d'applications filtrées.
- Le titre de la rangée reste « ACTIONS », en majuscules espacées, visuellement plus affirmé que les titres de chapitre de filtre.
- Les comportements métier (génération PDF, ouverture de Discover dans un nouvel onglet avec les ids filtrés, seuils de confirmation) restent strictement inchangés.
- Les états désactivé et « génération en cours » restent perceptibles.

### Non-Functional Requirements
- Rendu correct en thème clair **et** sombre : le fond clair des pastilles et la bulle sombre doivent rester lisibles dans les deux cas, via les tokens `--color-*` plutôt que des couleurs codées en dur.
- Accessibilité conservée : libellé accessible sur chaque bouton/lien, navigation clavier possible, info-bulle non bloquante (elle n'intercepte pas le pointeur).
- Aucun appel réseau supplémentaire, aucune nouvelle dépendance.
- L'info-bulle ne doit pas être tronquée par le panneau de filtres ni provoquer de décalage de mise en page.

## Scope

### In Scope
- Refonte visuelle des deux boutons d'action (forme ronde, taille, pictogrammes pleins).
- Remplacement du badge numérique par une info-bulle stylée porteuse du compteur.
- Ajustement du titre « ACTIONS ».
- Nouveaux pictogrammes PDF et partage/réseau.

### Out of Scope
- Ajout d'actions supplémentaires.
- Modification de la logique d'export PDF ou de construction de l'URL Discover.
- Refonte des autres chapitres du panneau de filtres.
- Généralisation de l'info-bulle stylée au reste de l'application (les autres `title` natifs restent en l'état pour cette itération).

## Affected Areas
- **Modifier** : `components/CatalogueActions.tsx` — forme des boutons, suppression du badge, info-bulle.
- **Modifier** : `components/icons/PdfIcon.tsx` et `components/icons/GraphIcon.tsx` — passage à des pictogrammes pleins conformes à la maquette (document « PDF », partage/réseau).
- **Modifier éventuellement** : `components/FilterBar.tsx` — style du titre « ACTIONS » si celui des chapitres de filtre ne convient pas.
- **Non touché** : `components/CatalogueClient.tsx` (logique et props inchangées), `components/FilterSheet.tsx`, l'export PDF, `lib/discoverSeed.ts`.

## Edge Cases
- Compteur à trois ou quatre chiffres (ex. 408) → affiché intégralement dans l'info-bulle, sans troncature ni repli « 99+ ».
- Compteur à 0 → boutons désactivés ; l'info-bulle reste affichable et indique « (0) ».
- Export en cours → l'info-bulle et le pictogramme reflètent l'état, le bouton n'est pas cliquable deux fois.
- Panneau de filtres mobile (`FilterSheet`) → même rendu ; l'info-bulle, dépendante du survol, ne doit pas empêcher l'usage tactile (le clic reste prioritaire).
- Thème sombre → les pastilles claires ne doivent pas « flasher » ni perdre le contraste du pictogramme.

## Open Questions
- L'info-bulle doit-elle aussi apparaître au **toucher** sur mobile (appui long), ou l'absence d'info-bulle y est-elle acceptable, l'action restant explicite par son pictogramme ?
- La pastille doit-elle rester **claire en thème sombre** (comme sur la maquette, fond blanc) ou s'inverser pour suivre le thème ?

## Acceptance Criteria
- [ ] Les deux actions sont des boutons ronds clairs à pictogramme plein, conformes à `temp/action.jpg`.
- [ ] Aucun badge numérique n'est superposé.
- [ ] Le survol et le focus clavier affichent une info-bulle stylée contenant le libellé complet et le nombre exact d'applications.
- [ ] Le pictogramme d'export est un document marqué « PDF » ; celui de Discover est une icône de partage/réseau.
- [ ] Les états désactivé et « génération en cours » restent perceptibles.
- [ ] Comportement d'export et d'ouverture de Discover strictement inchangé.
- [ ] Rendu correct en thème clair et sombre, build Next OK.
