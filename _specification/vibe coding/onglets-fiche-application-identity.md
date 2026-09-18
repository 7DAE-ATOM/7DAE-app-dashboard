# Feature Spec: Onglets fiche Application — structure + contenu Identity

## Summary
- Introduire, sur la fiche détail `/application?id=<externalId>`, un espace à onglets positionné juste sous les vignettes (`Gallery`), avec cinq onglets : **IDENTITY**, **ACCOUNTABILITY**, **COMPLIANCE**, **DOCUMENTATION**, **IN CONTEXT**.
- Cette itération crée la structure des cinq onglets (navigation cliquable, un seul panneau visible à la fois) mais **implémente uniquement le contenu de l'onglet Identity**. Les quatre autres onglets existent comme conteneurs vides (ou un placeholder minimal) tant que leur contenu n'est pas spécifié/implémenté dans une itération ultérieure.
- Le design de référence est le prototype visuel validé dans l'artefact Claude : `https://claude.ai/code/artifact/54f7fd27-1d2a-4200-9f15-94bf0822e7c0` (prototype HTML autonome, non connecté aux vraies données — sert de référence visuelle et de comportement, pas de source de vérité technique).

## Motivation
- La fiche détail actuelle affiche tous les attributs à plat sous la galerie, ce qui devient dense à mesure que de nouveaux attributs sont ajoutés (cf. `nouveaux-attributs-rest-application.md`, `lecture-videos-documents-atom-application.md`).
- Une structure à onglets a été prototypée et itérée visuellement dans un artefact Claude (voir lien ci-dessus) : disposition, palette de couleurs sémantique vs. catégorielle, traitement des `stat-card`, radar de conformité, etc. Cette spec porte la **première tranche** de ce prototype dans le vrai codebase, en commençant par la structure d'onglets et le contenu Identity, pour valider l'approche avant de porter le reste (Accountability, Compliance, Documentation, In Context) onglet par onglet.

## Décisions (arbitrées)
- **Découpage étape par étape explicitement demandé par l'utilisateur** : ne pas porter Accountability/Compliance/Documentation/In Context dans cette itération, même si leur contenu a déjà été designé dans l'artefact — chaque onglet fera l'objet d'une spec/implémentation séparée.
- **Contenu de l'onglet Identity** (repris du design artefact) :
  - Une rangée de `stat-card` : Version, Airbus Site, Program Category (icône avion), Part IS (icône shield/safety), Obso Risk Status (icône flèches de rafraîchissement — déjà utilisée par `RefreshButton.tsx`, à réutiliser pour cohérence visuelle).
  - Une carte Description reprenant le champ `description` existant de l'application.
- **Position** : l'espace à onglets est inséré juste sous les vignettes de `Gallery`, à la place de (ou au-dessus de) l'affichage à plat actuel des attributs sur la fiche détail.
- **Onglet actif par défaut** : Identity (premier onglet, contenu implémenté).
- **Les 4 autres onglets** : boutons de navigation fonctionnels (cliquables, changent de panneau), mais panneau vide/placeholder — pas de contenu métier dans cette itération.
- **Pas de nouveau champ ni nouvel appel réseau** : `version`, `airbusSite`, `programCategory`, `partIS`, `obsoRiskStatus`, `description` existent déjà dans `Application`/`ApplicationDto` (portés par `nouveaux-attributs-rest-application.md`).

## Requirements

### Functional Requirements
- La fiche détail affiche une barre d'onglets avec 5 boutons : Identity, Accountability, Compliance, Documentation, In Context.
- Un seul panneau d'onglet est visible à la fois ; cliquer un bouton active son panneau et désactive les autres.
- Identity est actif par défaut au chargement de la page.
- Le panneau Identity affiche :
  - Une rangée de cartes courtes (`stat-card`) : Version, Airbus Site, Program Category, Part IS, Obso Risk Status — chacune avec un intitulé, la valeur (ou un état "non renseigné" cohérent avec le reste de la fiche si absente), et une icône dédiée.
  - Une carte Description affichant le texte `application.description`.
- Les panneaux Accountability, Compliance, Documentation, In Context existent (boutons + conteneurs de panneau) mais restent vides ou avec un texte placeholder simple (ex. "À venir") dans cette itération.

### Non-Functional Requirements
- **Pas de nouvel appel réseau** : tous les champs affichés dans Identity sont déjà chargés par le fetch existant de la fiche détail.
- **Cohérence visuelle** avec les conventions déjà en place dans le repo (tokens de couleur `--color-*`, dark/light via `[data-theme]`, pas de nouvelle palette ad hoc) plutôt qu'une copie verbatim des couleurs codées en dur de l'artefact prototype.
- **Pas de régression** : les données actuellement affichées à plat sur la fiche (catégorie, statut, lifecycle, portfolio, operator & provider, managers, etc.) ne doivent pas disparaître — elles seront réparties dans les autres onglets au fil des itérations suivantes ; tant qu'un onglet n'est pas implémenté, son contenu antérieur reste visible ailleurs sur la fiche (voir Open Questions pour l'arbitrage exact de la transition).
- **Accessibilité de base** : navigation par onglets au clavier non requise pour cette itération (hors scope), mais les boutons doivent rester des éléments cliquables standards (`<button>`), pas des `<div>` avec `onClick` seul.

## Scope

### In Scope
- Composant(s) d'onglets (barre de boutons + panneaux) inséré(s) sous `Gallery` sur la fiche détail.
- Contenu complet de l'onglet Identity (stat-cards + description), avec les icônes spécifiées.
- Squelette vide/placeholder des 4 autres onglets.

### Out of Scope
- Contenu métier des onglets Accountability, Compliance, Documentation, In Context (itérations séparées).
- Le radar Compliance et son fichier de mapping JSON (`config/compliance-score-mapping.json` dans le prototype) — traité dans une spec dédiée à l'onglet Compliance.
- Les badges `coreBusinessStatus` / `resourceAdequacy` du prototype (positionnés hors des onglets, dans la sidebar) — hors scope de cette spec centrée sur les onglets.
- Migration des sections actuellement affichées à plat vers Accountability/Documentation — traité au moment de l'implémentation de ces onglets respectifs.

## Affected Areas
- **Modifier** : `components/ApplicationDetailClient.tsx` — insertion de l'espace à onglets sous `Gallery`.
- **Créer** : composant(s) dédiés aux onglets (ex. un composant `Tabs`/`TabPanel` réutilisable et un composant `IdentityTab`), suivant les conventions de structuration de composants du repo (`component-conventions`).
- **Non touché** : `lib/atom-api.ts`, `lib/types.ts`, `lib/application-adapter.ts` (aucun nouveau champ requis), `components/Gallery.tsx`, board catalogue, `/map`, export PDF.

## Edge Cases
- Un champ Identity absent/`null` (`version`, `airbusSite`, `programCategory`, `partIS`, `obsoRiskStatus`) → la `stat-card` correspondante affiche un état "non renseigné" (`—`), cohérent avec le reste de la fiche, plutôt que de masquer la carte.
- `description` vide → la carte Description s'affiche avec un état "non renseigné" plutôt que de disparaître.
- Clic répété sur l'onglet déjà actif → no-op (pas de re-render destructif, pas d'erreur).

## Open Questions
- **Sort des sections actuellement affichées à plat** (catégorie, statut, lifecycle, portfolio, operator & provider, managers, vidéos, documents, etc.) pendant la période transitoire où seul Identity est porté dans les onglets : restent-elles affichées telles quelles sous/à côté de l'espace à onglets le temps que les 4 autres onglets soient implémentés, ou faut-il les masquer dès cette itération ? => elles resteront affichées tel quel

- **Composant d'onglets** : réutiliser un pattern déjà présent dans le repo si un composant tab/segmented-control existe déjà, ou en créer un nouveau générique réutilisable pour les 4 prochains onglets ? => en créer un nouveau générique réutilisable

- **Icônes** : créer trois nouvelles icônes dédiées (avion pour Program Category, shield pour Part IS, réutilisation de l'icône `RefreshButton` pour Obso Risk Status), ou existe-t-il déjà des icônes équivalentes ailleurs dans `components/icons/` à réutiliser ? => créer 3 nouvelles icones dédiées

## Acceptance Criteria
- [ ] La fiche détail affiche une barre de 5 onglets (Identity, Accountability, Compliance, Documentation, In Context) juste sous les vignettes de `Gallery`.
- [ ] Identity est actif par défaut ; cliquer un autre onglet change le panneau visible.
- [ ] Le panneau Identity affiche Version, Airbus Site, Program Category, Part IS, Obso Risk Status en stat-cards avec icônes, plus une carte Description.
- [ ] Les 4 autres panneaux existent et sont navigables mais restent vides/placeholder.
- [ ] Aucun nouvel appel réseau, aucune régression sur le reste de la fiche détail.
- [ ] Build Next OK (`npm run build`).
