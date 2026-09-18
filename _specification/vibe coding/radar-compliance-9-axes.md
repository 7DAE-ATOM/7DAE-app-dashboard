# Feature Spec: Radar Compliance à 9 axes

## Summary
- Remplacer le contenu actuel de l'onglet **Compliance** de la fiche détail `/application?id=<externalId>` (2 "score cards" + message d'attente, limité à `functionalSuitability`/`technicalSuitability`) par le **radar complet à 9 axes** conçu dans le prototype artefact Claude, maintenant que la migration GraphQL (`_specification/vibe coding/migration-api-rest-vers-graphql-leanix.md`) rend disponibles les 7 attributs manquants.
- Les 9 attributs, leur mapping valeur→score (1-5) et le rendu radar (SVG dessiné à la main, sans librairie de graphe) ont déjà été validés visuellement dans le prototype ; cette spec porte leur implémentation avec de vraies données.

## Motivation
- L'onglet Compliance a été volontairement livré en portée réduite (`_specification/vibe coding/onglets-fiche-application-accountability-compliance-documentation.md`) car seuls 2 des 9 attributs du radar cible existaient côté API REST à l'époque.
- La migration vers GraphQL LeanIX expose désormais les 7 attributs restants (`securityAssesmtStatus`, `cyberSecurityLevel`, `businessSecurityLevel`, `ecCompliance`, `accessControlCompliance`, `deta06ComplianceStatus`, `mdcStatus`) — confirmés présents dans le schéma (`temp/getApp.txt`) et dans un échantillon réel (`temp/answer.txt`, application `7DAE`), avec des valeurs qui correspondent exactement aux clés déjà prévues dans le mapping du prototype.
- Le mapping valeur→score et la technique de rendu radar existent déjà dans le prototype (`atom-detail-redesign.html`) — cette itération les porte dans le vrai codebase plutôt que de les redéfinir.

## Décisions (arbitrées)
- **9 axes, mapping repris du prototype** (à valider — voir Open Questions pour le seul point non confirmé par l'utilisateur) :
  - `securityAssesmtStatus` : notAssessed(1), assessed(5)
  - `cyberSecurityLevel` : notDefined(1), highRisk(2), mediumRisk(3), smallRisk(4), compliant(5)
  - `businessSecurityLevel` : notDefined(1), highRisk(2), mediumRisk(3), smallRisk(4), compliant(5)
  - `ecCompliance` : notAssessed(1), no_notCompliant(2), yes(5), no_notNeeded(5)
  - `accessControlCompliance` : notAssessed(1), no_notCompliant(2), yes_partially(4), yes_fully(5), no_notNeeded(5)
  - `deta06ComplianceStatus` : low(1), medium(3), high(5)
  - `mdcStatus` : notStarted(1), informationRequested(2), inProgress(2), assessed(5)
  - `functionalSuitability` : inappropriate(1), unreasonable(2), adequate(4), fullyAppropriate(5) *(déjà en place)*
  - `technicalSuitability` : inappropriate(1), unreasonable(2), adequate(4), fullyAppropriate(5) *(déjà en place)*
- **Le mapping reste dans un fichier de ressource dédié** (`lib/compliance-score-mapping.json`, déjà créé pour les 2 premiers attributs), lu au chargement — pas de valeur codée en dur dans un composant, pour rester modifiable sans toucher à l'adaptateur.
- **Rendu radar** : SVG dessiné à la main (grille de 5 niveaux, 9 rayons, polygone de données, points, libellés d'axe), comme déjà fait pour le prototype et pour l'anneau de complétion existant (`components/detail/*Tab.tsx`) — pas de librairie de graphe, pour éviter le problème déjà rencontré avec Chart.js dans un onglet caché (`display:none`) au premier rendu.
- **Le message d'attente disparaît** : une fois les 9 attributs disponibles, l'onglet affiche directement le radar complet — plus de portée réduite.
- **Aucune valeur inventée** : si un attribut est absent ou si sa valeur brute ne correspond à aucune clé du mapping, son score reste indéfini plutôt que d'être deviné (cohérent avec la NFR déjà en place sur cet onglet).

## Requirements

### Functional Requirements
- L'onglet Compliance affiche un radar à 9 axes (un par attribut listé ci-dessus), avec la grille de niveaux 1 à 5 et le polygone de score de l'application.
- Chaque axe affiche son libellé lisible (ex. "Cyber Security", "DETA06", "MDC Status" — repris du prototype).
- Une liste/complément textuel (déjà présent pour les 2 axes actuels) affiche, pour chaque attribut : libellé, valeur brute, score coloré selon la sévérité (`good`/`warn`/`risk`, seuils déjà définis : ≥4 good, =3 warn, ≤2 risk).
- Un attribut absent ou dont la valeur brute est inconnue du mapping s'affiche comme "non renseigné"/score indéterminé, sans faire échouer le rendu du radar (le radar utilise alors une valeur neutre pour cet axe, à définir en Open Questions).

### Non-Functional Requirements
- **Pas de nouvel appel réseau supplémentaire** : les 7 attributs sont ajoutés à la requête GraphQL déjà utilisée pour lire une Application (une seule requête, pas d'aller-retour additionnel).
- **Cohérence visuelle** avec les tokens déjà en place (`--color-*`) et le pattern d'onglet existant (`components/detail/Tabs.tsx`) — le radar doit se dessiner correctement même si Compliance n'est pas l'onglet actif au premier rendu (leçon retenue du prototype : éviter toute dépendance à la mesure de conteneur).
- **Pas de régression** sur les autres onglets (Identity, Accountability, Documentation, In Context) ni sur le reste de la fiche détail.

## Scope

### In Scope
- Extension de la requête GraphQL, de `ApplicationNode`, de `Application` et de l'adaptateur pour les 7 attributs manquants.
- Extension de `lib/compliance-score-mapping.json` / `lib/compliance-score.ts` aux 9 attributs.
- Remplacement du contenu de `ComplianceTab.tsx` par le radar SVG complet + liste de scores, à la place des 2 score-cards et du message d'attente actuels.

### Out of Scope
- Les autres attributs exposés par GraphQL mais non liés au radar de conformité (`coreBusinessStatus`, `resourceAdequacy`, `docQualityStatus`, `globalQualityLevel`, `compliantProcess`, `kpi_*`) — itérations séparées (badges sidebar, etc., déjà notés dans la spec de migration GraphQL).
- Toute modification des autres onglets.
- Le fichier `config/compliance-score-mapping.json` mentionné dans le prototype d'origine reste `lib/compliance-score-mapping.json` (emplacement déjà choisi lors de l'implémentation de la portée réduite) — pas de déplacement.

## Affected Areas
- **Modifier** : `lib/leanix-application-query.ts` (7 champs GraphQL supplémentaires), `lib/atom-api.ts` (`ApplicationNode` étendu), `lib/types.ts` (`Application` étendu), `lib/application-adapter.ts` (mapping des 7 nouveaux champs).
- **Modifier** : `lib/compliance-score-mapping.json`, `lib/compliance-score.ts` (support des 9 attributs au lieu de 2).
- **Modifier** : `components/detail/ComplianceTab.tsx` (radar SVG à 9 axes en remplacement du contenu réduit actuel).
- **Non touché** : `IdentityTab`, `AccountabilityTab`, `DocumentationTab`, `Tabs.tsx`, board catalogue, `/map`, export PDF.

## Edge Cases
- Attribut absent (`null`) chez une application donnée → axe correspondant sans score déterminé (voir Open Questions pour son traitement visuel exact : point au centre / axe grisé / valeur neutre).
- Valeur brute reçue qui ne correspond à aucune clé du mapping (évolution de vocabulaire backend non répercutée) → même traitement que "absent", jamais une valeur inventée.
- Application avec les 9 attributs tous renseignés et reconnus → radar plein, cas nominal déjà validé visuellement dans le prototype.

## Open Questions
- **Score de `securityAssesmtStatus`** : le prototype utilise `notAssessed: 1, assessed: 5`, mais la toute première demande utilisateur ne donnait que les deux valeurs possibles sans score entre parenthèses (contrairement aux autres attributs). Ce mapping binaire est-il confirmé, ou faut-il une autre valeur ? => mapping confirmé

- **Traitement visuel d'un axe sans score déterminé** : le radar doit-il traiter cet axe comme un score de 0 (point au centre), l'exclure temporairement du polygone, ou afficher un état "insuffisant de données" distinct pour l'application entière ? => score de 0

- **Libellés d'axes** : reprendre tels quels ceux du prototype ("Security Assessment", "Cyber Security", "Business Security", "EC Compliance", "Access Control", "DETA06", "MDC Status", "Functional Suitab.", "Technical Suitab.") ou les revoir ? reprendre tel quel

## Acceptance Criteria
- [ ] L'onglet Compliance affiche un radar à 9 axes avec la grille de niveaux et le polygone de score, plus une liste détaillée (libellé/valeur brute/score coloré) pour chaque attribut.
- [ ] Les 7 attributs manquants sont lus via la requête GraphQL existante (aucun appel réseau supplémentaire) et mappés jusqu'à `Application`.
- [ ] Le mapping valeur→score des 9 attributs vit dans `lib/compliance-score-mapping.json`, sans valeur codée en dur ailleurs.
- [ ] Un attribut absent ou à valeur inconnue n'entraîne jamais un score inventé ni une erreur de rendu.
- [ ] Le radar se dessine correctement que Compliance soit ou non l'onglet actif au premier chargement de la page.
- [ ] Aucune régression sur les autres onglets ni sur le reste de la fiche détail.
- [ ] Build Next OK (`npm run build`).
