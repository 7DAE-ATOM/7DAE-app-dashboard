# Feature Spec: Nouveaux attributs REST — Application

## Summary
- La requête REST existante `GET {ATOM_API_BASE_URL}/api/infos/applications` (liste) et `GET {ATOM_API_BASE_URL}/api/infos/applications/{externalId}` (détail) va désormais retourner onze attributs supplémentaires pour chaque application : `airbusSite`, `businessCriticality`, `functionalSuitability`, `technicalSuitability`, `programCategory`, `partIS`, `obsoRiskStatus`, `BRDURL`, `ARDURL`, `confluenceURL`, `gDrivePath`.
- Modifier le data model (`lib/atom-api.ts` → `ApplicationDto`, `lib/types.ts` → `Application`, `lib/application-adapter.ts`) pour lire ces champs depuis la réponse REST déjà en place, puis les afficher sur la fiche détail `/application?id=<externalId>`.
- Aucune nouvelle source de données, aucun nouvel appel réseau : ce sont des champs ajoutés à une réponse déjà consommée aujourd'hui par `fetchApplications`/`fetchApplication`.

## Motivation
- Une précédente spec (`_specification/vibe coding/integration-graphql-attributs-etendus-application.md`) envisageait de récupérer ce même jeu de onze attributs via une **nouvelle source GraphQL** distincte, avec plusieurs questions bloquantes (endpoint, authentification, stratégie de fusion REST/GraphQL). Cette nouvelle demande indique que le backend `atom-synchronizer-dev` va en réalité exposer ces mêmes attributs directement dans sa réponse REST existante — ce qui supprime le besoin d'une intégration GraphQL séparée pour ces champs et lève les questions bloquantes liées à l'endpoint/auth GraphQL.
- Cette spec **remplace, pour ces onze attributs**, l'approche envisagée dans la spec GraphQL précédente. Elle ne couvre pas la relation `relApplicationToBusinessCapability` mentionnée dans cette dernière (non reprise ici — voir Open Questions).
- `airbusSite` était identifié comme absent de l'API REST lors de l'intégration initiale des Applications (cf. `_specification/vibe coding/integration-api-applications.md`, section Décisions : "sera ajouté plus tard côté backend — confirmé"). Son arrivée via REST est la concrétisation de cette promesse, et ouvre la voie à peupler `/map` (actuellement vide faute de donnée de localisation).

## Décisions (arbitrées)

### Source de données
- Les onze attributs sont lus depuis la réponse REST existante (`ApplicationDto`), au même titre que les champs déjà présents (`name`, `appCategory`, `appStatus`, etc.). Aucune nouvelle fonction de fetch, aucun nouveau module d'accès aux données.

### Conflit `businessCriticality`
- Le champ `businessCriticality` existe déjà dans `ApplicationDto` (`missionCritical` | `businessCritical` | `businessOperational` | `administrativeService`) et est déjà affiché sur la fiche détail via `BUSINESS_CRITICALITY_LABELS`.
- Cette spec ne tranche pas si le `businessCriticality` mentionné dans la demande est le **même champ** (confirmation qu'il continue d'être retourné, sans changement) ou un **nouveau domaine de valeurs** qui le remplace — voir Open Questions. Tant que non arbitré, l'implémentation ne doit pas silencieusement modifier le domaine de valeurs existant.

### Portée de l'affichage
- Les dix attributs restants (hors `businessCriticality`, déjà affiché) sont ajoutés sur la fiche détail `/application?id=<externalId>` uniquement — pas sur le board catalogue, pas sur `/map`, pas dans l'export PDF, pour cette itération.
- Disposition : simple, à la suite des sections existantes, dans une nouvelle section dédiée. La mise en forme définitive (groupement, libellés enrichis pour les enums, etc.) pourra être revue dans une itération ultérieure.

## Requirements

### Functional Requirements
- `ApplicationDto` (`lib/atom-api.ts`) intègre les dix nouveaux champs scalaires optionnels : `airbusSite`, `functionalSuitability`, `technicalSuitability`, `programCategory`, `partIS`, `obsoRiskStatus`, `BRDURL`, `ARDURL`, `confluenceURL`, `gDrivePath`.
- `Application` (`lib/types.ts`) et l'adapter (`lib/application-adapter.ts`) exposent ces champs à l'UI, avec le même traitement de tolérance aux valeurs manquantes que les champs optionnels déjà en place (ex. `version`, `operator`).
- La fiche détail affiche, dans une nouvelle section, les dix attributs lorsqu'ils sont disponibles.
- Les quatre champs URL (`BRDURL`, `ARDURL`, `confluenceURL`, `gDrivePath`) sont rendus comme liens cliquables ouvrant un nouvel onglet lorsqu'ils sont renseignés.

### Non-Functional Requirements
- **Pas de nouvel appel réseau** : ces champs arrivent dans la réponse REST déjà appelée aujourd'hui ; aucune confirmation réseau supplémentaire n'est nécessaire au sens de la règle CLAUDE.md "Network calls — ask first" (le endpoint et la méthode d'appel restent inchangés).
- **Pas de régression** sur les champs et sections déjà affichés (catégorie, statut, lifecycle, portfolio, operator & provider, managers, `businessCriticality` existant).
- **Tolérance à l'absence de champ** : tant que le backend n'a pas déployé le changement, ces champs seront `undefined`/absents de la réponse JSON — l'adapter et l'affichage doivent gérer ce cas sans erreur (comme pour tout champ optionnel actuel).

## Scope

### In Scope
- Extension de `ApplicationDto`, `Application` et de l'adapter pour les dix nouveaux champs scalaires (hors `businessCriticality`, déjà présent).
- Affichage basique de ces champs sur la fiche détail, y compris rendu cliquable des quatre champs URL.
- Clarification/arbitrage du statut de `businessCriticality` (champ existant confirmé vs nouveau domaine) avant implémentation de ce champ précis.

### Out of Scope
- La relation `relApplicationToBusinessCapability` (issue de la spec GraphQL précédente) — non reprise ici.
- Utilisation d'`airbusSite` pour peupler `/map` — feature séparée.
- Filtres catalogue sur les nouveaux attributs.
- Export PDF des nouveaux attributs.
- Disposition/maquette définitive de l'affichage — itération future.

## Affected Areas
- **Modifier** : `lib/atom-api.ts` (`ApplicationDto` étendu).
- **Modifier** : `lib/types.ts` (`Application` étendu).
- **Modifier** : `lib/application-adapter.ts` (mapping DTO → UI pour les nouveaux champs).
- **Modifier** : `components/ApplicationDetailClient.tsx` (ou un nouveau sous-composant dédié) pour afficher les nouveaux champs.
- **Non touché** : board catalogue (`ApplicationCard.tsx`), `/map`, filtres (`FilterBar.tsx`/`FilterSheet.tsx`), export PDF (`components/pdf/*`).
- **À réconcilier** : `_specification/vibe coding/integration-graphql-attributs-etendus-application.md` devient obsolète pour les onze attributs scalaires (conservée pour la seule relation Business Capabilities, ou à supprimer/fusionner — voir Open Questions).

## Edge Cases
- Un attribut absent ou `null` pour une application donnée → affiché avec un état "non renseigné" cohérent avec le reste de la fiche (ex. "—").
- Backend pas encore mis à jour (champs absents de la réponse JSON) → la fiche détail reste utilisable, la nouvelle section affiche "—" pour chaque champ plutôt que de faire échouer la page.
- URLs malformées ou vides (`BRDURL`, `ARDURL`, `confluenceURL`, `gDrivePath`) → pas de lien cassé affiché comme cliquable ; un champ vide suit la même convention "non renseigné" que les autres.
- Conflit `businessCriticality` (cf. Décisions) → tant que non arbitré, l'implémentation ne modifie pas le champ existant sans décision explicite.

## Open Questions
- **`businessCriticality`** : s'agit-il du champ REST déjà existant (confirmation qu'il est inchangé), ou d'un nouveau domaine de valeurs qui le remplace ? Bloquant pour ce champ précis uniquement — les dix autres champs ne sont pas concernés. => existant
- **Domaines de valeurs des enums** : `functionalSuitability`, `technicalSuitability`, `programCategory`, `partIS`, `obsoRiskStatus` — quelles sont les valeurs possibles pour chacun ? Nécessaire pour prévoir des libellés lisibles (comme `STATUS_LABELS`/`CATEGORY_LABELS` existants) plutôt que d'afficher des codes bruts tels quels en attendant.
=> dans un premier temps, affiche les valauers telles qu'elles sont retounés, sans labellisation
- **Devenir de la spec GraphQL précédente** : `integration-graphql-attributs-etendus-application.md` doit-elle être supprimée, ou conservée uniquement pour la relation `relApplicationToBusinessCapability` qui n'est pas couverte ici ?
=> à supprimé
- **Date/version de disponibilité backend** : à partir de quand le backend `atom-synchronizer-dev` retourne-t-il effectivement ces champs, pour savoir si l'implémentation peut être testée contre l'API réelle (soumis à la règle CLAUDE.md "ask first" avant tout appel réel) ? dés maintenant

## Acceptance Criteria
- [ ] `ApplicationDto` expose les dix nouveaux champs scalaires optionnels (hors `businessCriticality`).
- [ ] `Application` et l'adapter exposent ces champs à l'UI, avec gestion des valeurs manquantes.
- [ ] La fiche détail affiche, dans une nouvelle section, les dix attributs lorsqu'ils sont disponibles, avec les quatre champs URL rendus comme liens cliquables.
- [ ] L'absence de ces champs dans la réponse JSON (backend pas encore mis à jour) n'empêche pas l'affichage du reste de la fiche.
- [ ] Aucun nouvel appel réseau introduit.
- [ ] Build Next OK, pas de régression sur les sections existantes de la fiche détail, sur le board catalogue, ni sur `/map`.
