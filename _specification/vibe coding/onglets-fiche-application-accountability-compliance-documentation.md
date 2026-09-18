# Feature Spec: Onglets fiche Application — Accountability, Compliance, Documentation

## Summary
- Suite à `_specification/vibe coding/onglets-fiche-application-identity.md` (structure à 5 onglets + contenu Identity, déjà implémentée), cette itération implémente le **contenu** de trois onglets supplémentaires sur la fiche détail `/application?id=<externalId>` : **Accountability**, **Compliance**, **Documentation**. L'onglet **In Context** reste hors scope (placeholder "Coming soon" inchangé).
- Le design de référence reste le prototype visuel de l'artefact Claude : `https://claude.ai/code/artifact/54f7fd27-1d2a-4200-9f15-94bf0822e7c0` (référence visuelle/conceptuelle uniquement, pas source de vérité technique — les couleurs/tokens suivent les conventions déjà en place dans ce repo, comme pour Identity).

## Motivation
- L'onglet Identity a validé le pattern (composant `Tabs` générique, `IdentityTab`, stat-cards) ; cette spec porte la suite du découpage étape par étape explicitement demandé par l'utilisateur.
- Accountability et Documentation regroupent des champs déjà exposés par `Application`/`ApplicationDto` (portés par `nouveaux-attributs-rest-application.md` et l'intégration API initiale) et déjà affichés à plat ailleurs sur la fiche (`Section title="Operator & Provider"`, `ManagerCard`, `Section title="Additional Information"` pour les URLs) — cette itération les reprend sous forme de cartes dans l'onglet correspondant, sans changer la donnée.
- Compliance est différent : le radar à 9 axes conçu dans le prototype repose sur des attributs (`securityAssesmtStatus`, `cyberSecurityLevel`, `businessSecurityLevel`, `ecCompliance`, `accessControlCompliance`, `deta06ComplianceStatus`, `mdcStatus`) qui **n'existent pas encore** dans `Application`/`ApplicationDto`. Seuls deux des neuf axes prévus (`functionalSuitability`, `technicalSuitability`) sont déjà disponibles. Cette spec doit donc arbitrer une portée réduite/temporaire pour Compliance en attendant que le backend expose le reste (voir Open Questions).

## Décisions (arbitrées)
- **Découpage étape par étape** : seuls Accountability, Compliance, Documentation sont couverts ici ; In Context reste un placeholder "Coming soon".
- **Accountability** (repris du design artefact, ordre déjà validé lors de l'itération artefact : Portfolio → Dept Provider → Operator → Provider Type) :
  - Une rangée de stat-cards : Portfolio, Dept Provider, Operator, Provider Type.
  - Une section People avec une carte par personne (Application Manager, Solution Architect) — réutilise le pattern `ManagerCard` déjà existant plutôt que d'en recréer un.
- **Documentation** (repris du design artefact) :
  - Chips de type fichier (icône + libellé) pour ARD, BRD, Confluence, Google Drive, cliquables vers `ARDURL`/`BRDURL`/`confluenceURL`/`gDrivePath` quand renseignés ; état désactivé/« non défini » sinon (même logique de validation d'URL que l'`UrlField`/`isValidUrl` déjà présents dans `ApplicationDetailClient.tsx`).
- **Compliance** : portée réduite à ce qui est réellement disponible aujourd'hui (voir Open Questions pour la décision finale) — cette itération ne bloque pas sur l'absence des 7 attributs manquants, mais ne doit pas non plus afficher un radar trompeur basé sur des données inventées.
- **Pas de nouveau champ ni nouvel appel réseau** pour Accountability/Documentation — tout est déjà présent sur `Application`.
- **Sections existantes à plat** : comme pour Identity, elles restent affichées telles quelles (Operator & Provider, Additional Information, ManagerCard grid) — cette itération est additive, pas un remplacement. Une itération future décidera de leur retrait une fois tous les onglets couverts.

## Requirements

### Functional Requirements
- L'onglet Accountability affiche une rangée de stat-cards (Portfolio, Dept Provider, Operator, Provider Type) puis une section People listant Application Manager et Solution Architect (nom + email), avec un état "non renseigné" cohérent quand une donnée est absente.
- L'onglet Documentation affiche 4 chips fichier (ARD, BRD, Confluence, Google Drive) : cliquable/ouvre un nouvel onglet quand l'URL correspondante est valide et non vide, visuellement désactivé sinon.
- L'onglet Compliance affiche, au minimum, les attributs déjà disponibles (`functionalSuitability`, `technicalSuitability`) sous une forme cohérente avec le pattern radar/score visé à terme — la forme exacte (radar partiel à 2 axes, liste de scores, ou message d'attente) est tranchée dans Open Questions.
- L'onglet In Context reste inchangé ("Coming soon").

### Non-Functional Requirements
- **Pas de nouvel appel réseau** pour Accountability/Documentation (champs déjà chargés). Pour Compliance, aucun appel réseau supplémentaire dans cette itération quelle que soit l'option retenue.
- **Cohérence visuelle** avec les tokens et le composant `Tabs`/pattern stat-card déjà établis par l'onglet Identity (`components/detail/IdentityTab.tsx`) — réutiliser le même `StatCard` plutôt qu'en recréer un.
- **Pas de régression** sur les sections existantes affichées à plat, ni sur l'onglet Identity déjà livré.
- **Compliance ne doit jamais afficher une valeur inventée** pour un attribut non disponible dans les données actuelles.

## Scope

### In Scope
- Contenu de l'onglet Accountability (stat-cards + section People).
- Contenu de l'onglet Documentation (4 chips fichier).
- Contenu (réduit) de l'onglet Compliance, limité aux attributs réellement disponibles aujourd'hui.

### Out of Scope
- L'onglet In Context (reste "Coming soon").
- Le radar Compliance complet à 9 axes et son fichier de mapping JSON — bloqué tant que les 7 attributs manquants ne sont pas exposés par le backend (cf. `securityAssesmtStatus`, `cyberSecurityLevel`, `businessSecurityLevel`, `ecCompliance`, `accessControlCompliance`, `deta06ComplianceStatus`, `mdcStatus`).
- Les badges `coreBusinessStatus` / `resourceAdequacy` du prototype (sidebar, hors onglets) — non couverts ici.
- Retrait des sections actuellement affichées à plat (Operator & Provider, Additional Information, ManagerCard grid) — décision différée.

## Affected Areas
- **Modifier** : `components/ApplicationDetailClient.tsx` — remplacer les placeholders "Coming soon" d'Accountability, Compliance, Documentation par leur contenu réel dans le tableau `tabs`.
- **Créer** : `components/detail/AccountabilityTab.tsx`, `components/detail/DocumentationTab.tsx`, `components/detail/ComplianceTab.tsx` (ou nom équivalent selon la portée retenue), réutilisant `StatCard` (à extraire de `IdentityTab.tsx` si partagé) et `ManagerCard`.
- **Non touché** : `lib/atom-api.ts`, `lib/types.ts`, `lib/application-adapter.ts` (aucun nouveau champ pour Accountability/Documentation), `components/Gallery.tsx`, board catalogue, `/map`, export PDF.

## Edge Cases
- `deptProviders` vide → stat-card affiche "—" (cohérent avec le rendu actuel `dl` de "Operator & Provider").
- `manager`/`solutionArchitect` absents → section People affiche un état "non renseigné" par personne plutôt que de masquer la carte (cohérent avec `ManagerCard` actuel qui affiche déjà "Not set" pour le manager).
- URLs de documentation vides ou invalides → chip non cliquable, pas de lien cassé.
- Compliance avec `functionalSuitability`/`technicalSuitability` absents → état "non renseigné" plutôt qu'une valeur par défaut arbitraire.

## Open Questions
- **Portée exacte de l'onglet Compliance dans cette itération** : (a) radar partiel affichant uniquement les 2 axes disponibles (`functionalSuitability`, `technicalSuitability`), (b) simple liste/stat-cards de ces 2 attributs sans visualisation radar (le radar n'aurait de sens qu'à partir de 3 axes), ou (c) message "en attente des attributs backend" avec les 2 valeurs disponibles affichées à part ? Bloquant pour l'implémentation de cet onglet précis. => fais un message

- **Mapping des valeurs Compliance vers un score 1-5** : même pour les 2 axes disponibles, faut-il déjà appliquer le mapping `fullyAppropriate(5), adequate(4), unreasonable(2), inappropriate(1)` défini dans l'artefact (fichier JSON dédié comme prévu à l'origine), ou afficher la valeur brute en attendant que le reste du radar soit implémenté ? fais el fichier json

- **Composant `StatCard`** : doit-il être extrait de `IdentityTab.tsx` vers un module partagé (ex. `components/detail/StatCard.tsx`) maintenant que 2 onglets supplémentaires le réutilisent, ou dupliqué tel quel dans chaque onglet ? => oui crée un module partagé

- **Retrait des sections à plat** : cette spec les laisse en place comme pour Identity — à quel moment (après tous les onglets ? dès maintenant pour Accountability/Documentation qui sont déjà entièrement couverts par leur onglet ?) faut-il les retirer pour éviter la duplication visuelle permanente ? => oui supprime les maintenant

## Acceptance Criteria
- [ ] L'onglet Accountability affiche Portfolio, Dept Provider, Operator, Provider Type en stat-cards, plus une section People (Application Manager, Solution Architect).
- [ ] L'onglet Documentation affiche 4 chips fichier (ARD, BRD, Confluence, Google Drive), cliquables uniquement quand l'URL est valide et renseignée.
- [ ] L'onglet Compliance affiche, sans donnée inventée, ce qui est disponible aujourd'hui (`functionalSuitability`, `technicalSuitability`) selon la portée arbitrée en Open Questions.
- [ ] L'onglet In Context reste inchangé.
- [ ] Aucun nouvel appel réseau, aucune régression sur l'onglet Identity ni sur les sections existantes affichées à plat.
- [ ] Build Next OK (`npm run build`).
