# Feature Spec: Pop-up d'avertissement « Show in Discover » au-delà du seuil

## Summary
- Aujourd'hui, cliquer sur « Show in Discover » avec plus de **100** applications filtrées déclenche un `alert()` natif du navigateur et **refuse** l'action ; entre **26 et 100**, un `window.confirm()` natif demande confirmation.
- Remplacer ces boîtes natives par une **modale applicative** cohérente avec le reste du dashboard (même pattern que `AboutDialog` / la modale d'agrandissement Discover).
- Le dépassement du seuil haut n'est plus un **refus** mais un simple **avertissement** : la modale propose « Continue » (l'action se poursuit) et « Cancel » (rien ne se passe).

## Motivation
- `alert()` et `confirm()` sont non stylables, sortent du thème clair/sombre, s'affichent différemment selon le navigateur, et bloquent totalement la page. Sur un dashboard soigné, ils cassent l'expérience.
- Surtout, le refus pur et simple au-delà de 100 est frustrant : l'utilisateur qui a délibérément filtré une large sélection n'a aucun moyen de passer outre, alors que la contrainte est une question de confort d'affichage, pas d'intégrité.
- Le codebase dispose déjà du pattern de modale (overlay, `role="dialog"`, fermeture Échap / clic overlay / bouton), utilisé par la boîte « À propos » et la modale des applications sélectionnées de Discover — aucune nouvelle mécanique à inventer.

## Décisions (arbitrées)

### Comportement au-delà du seuil haut (> 100)
- L'action n'est plus bloquée. La modale affiche un avertissement expliquant que la sélection est volumineuse et ce que cela implique (graphe dense, chargement des relations plus long).
- Deux actions : **Continue** (bouton principal) → l'ouverture de Discover se poursuit ; **Cancel** (bouton secondaire) → rien ne se passe, la modale se ferme, l'utilisateur reste sur le catalogue.

### Unification des deux seuils
- Le seuil intermédiaire (> 25, actuellement un `confirm()` natif) passe par la **même modale**, avec un message adapté. Il n'y a donc plus aucune boîte native sur ce parcours : un seul composant d'avertissement, deux messages.
- Le seuil bas inchangé : à 25 applications ou moins, l'ouverture est directe, sans modale.

### Cohérence visuelle et interaction
- Overlay sombre, panneau arrondi bordé, titre, corps de texte, deux boutons alignés à droite — dans l'esprit des modales existantes, avec les tokens `--color-*` (lisible en thème clair et sombre).
- Fermeture possible par `Échap`, clic sur l'overlay et bouton « Cancel » — tous équivalents à une annulation.
- Focus placé à l'ouverture sur l'action la moins risquée (« Cancel »), navigation clavier fonctionnelle.

## Requirements

### Functional Requirements
- Cliquer sur « Show in Discover » avec une sélection au-dessus du seuil de confirmation ouvre une modale applicative (plus aucun `alert()` ni `confirm()` sur ce parcours).
- La modale indique le nombre exact d'applications concernées et la conséquence attendue.
- Le bouton « Continue » poursuit l'ouverture de Discover dans un nouvel onglet, avec exactement les mêmes ids qu'aujourd'hui.
- Le bouton « Cancel », la touche `Échap` et le clic sur l'overlay annulent l'action sans effet de bord.
- En dessous du seuil de confirmation, le comportement reste inchangé : ouverture immédiate, sans modale.

### Non-Functional Requirements
- Aucune régression sur la construction du lien Discover ni sur l'ouverture en nouvel onglet.
- Accessibilité : `role="dialog"`, `aria-modal`, titre associé, focus initial maîtrisé, restitution du focus au bouton d'origine à la fermeture.
- Thème clair et sombre corrects, via tokens uniquement.
- Aucun appel réseau, aucune nouvelle dépendance : réutilisation du pattern de modale déjà présent.
- L'ouverture du nouvel onglet doit rester fiable : déclenchée par un vrai geste utilisateur (le clic sur « Continue »), pour ne pas être bloquée comme pop-up par le navigateur.

## Scope

### In Scope
- Modale d'avertissement applicative pour « Show in Discover », avec « Continue » / « Cancel ».
- Passage du dépassement du seuil haut d'un refus à un avertissement franchissable.
- Remplacement du `confirm()` du seuil intermédiaire par la même modale.

### Out of Scope
- Le `confirm()` de l'export PDF (« Export all N applications as PDF? ») — même problème, mais action différente ; à traiter séparément si le besoin se confirme.
- Les `alert()` d'erreur d'export PDF.
- Modification des valeurs de seuils elles-mêmes.
- Comportement de la vue Discover une fois ouverte.

## Affected Areas
- **Modifier** : `components/CatalogueClient.tsx` — la logique `handleShowInDiscover` (actuellement `alert` + `confirm` + `preventDefault`) devient l'ouverture d'une modale et la poursuite différée de l'action.
- **Modifier éventuellement** : `components/CatalogueActions.tsx` — si l'ouverture de Discover ne peut plus être un simple `<Link>` suivi immédiatement, mais doit passer par une navigation déclenchée après confirmation.
- **Créer** : un composant de modale d'avertissement réutilisable sous `components/`.
- **Référence (non modifié)** : `components/AboutDialog.tsx` et `components/discover/SelectedApplicationsDialog.tsx` — pattern de modale à répliquer.
- **À vérifier** : `lib/discoverSeed.ts` — `SEED_MAX` y sert aussi à **tronquer** côté Discover (`parseSeedIds`) ; voir Open Questions.

## Edge Cases
- **Sélection entre 26 et 100** → modale « confirmation », message neutre, « Continue » ouvre Discover.
- **Sélection au-dessus de 100** → modale « avertissement », message plus explicite sur la densité du graphe, mais « Continue » reste disponible.
- **Sélection à 0** → le bouton reste désactivé, la modale n'est jamais atteignable.
- **Troncature côté Discover** : `parseSeedIds` limite la lecture à `SEED_MAX` ids. Si l'utilisateur continue avec 150 applications, Discover n'en affichera que 100 — l'avertissement doit dire la vérité sur ce point, ou la limite doit être levée (cf. Open Questions).
- **Double clic / réouverture** → une seule modale à la fois, pas d'ouverture multiple d'onglets.
- **Blocage des pop-ups navigateur** → l'ouverture doit rester rattachée au clic sur « Continue ».

## Open Questions
- **Troncature à 100 côté Discover** : si l'utilisateur peut désormais passer outre, faut-il (a) lever la limite de `parseSeedIds` pour honorer réellement sa demande, ou (b) la conserver et l'annoncer explicitement dans la modale (« seules les 100 premières seront affichées ») ? => oui léve la limite

- **Formulation et ton** : un seul libellé de modale pour les deux seuils, ou deux messages distincts (« beaucoup d'applications » vs « très grande sélection ») ? => un seul libellé

- **Case « ne plus me demander »** : utile pour l'utilisateur qui franchit le seuil souvent, ou complexité inutile pour cette itération ? => non

## Acceptance Criteria
- [ ] Plus aucun `alert()` ni `window.confirm()` natif sur le parcours « Show in Discover ».
- [ ] Au-delà du seuil haut, l'action n'est plus refusée : une modale d'avertissement propose « Continue » et « Cancel ».
- [ ] « Continue » ouvre Discover dans un nouvel onglet avec les mêmes ids qu'auparavant.
- [ ] « Cancel », `Échap` et le clic sur l'overlay annulent sans effet de bord.
- [ ] Sous le seuil de confirmation, l'ouverture reste immédiate.
- [ ] La modale est accessible (dialogue, focus, clavier) et correcte en thème clair et sombre.
- [ ] Build Next OK, aucune régression sur le catalogue ni sur l'export PDF.
