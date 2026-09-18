# Feature Spec: Radar Compliance recalculé sur 5 axes KPI

## Summary
- Remplacer le radar à 9 axes de l'onglet Compliance (`_specification/vibe coding/radar-compliance-9-axes.md`, implémenté) par un **radar à 5 axes** calculé à partir de champs KPI multivalués : `kpi_functionalSuitability`, `kpi_maintainability`, `kpi_understandability`, `kpi_security`, plus `deta06ComplianceLevel` (déjà un pourcentage) et son complément `deta06MissingDocs`.
- Chaque axe (sauf DETA06) devient un **pourcentage** = nombre de valeurs présentes ÷ nombre de valeurs possibles pour ce champ — la cible visuelle est une application qui a toutes les valeurs possibles sur tous les axes.
- Le tableau détaillé à droite du radar affiche, par axe, la liste des documents/éléments **présents ou manquants** selon un **toggle Delivered/Missing** — DETA06 est un cas particulier : jamais de liste "présents" (seulement `deta06MissingDocs`), donc sa ligne disparaît quand le toggle est sur Delivered.

## Motivation
- Le radar à 9 axes portait des attributs de conformité qualitatifs (sécurité, EC, DETA06 en 3 paliers, etc.). Cette itération le remplace par une mesure plus opérationnelle et actionnable : quels documents/éléments concrets manquent pour chaque application, regroupés en 5 catégories (Suitability, Maintainability, Understandability, Security, DETA06).
- Les champs KPI (`kpi_functionalSuitability`, `kpi_maintainability`, `kpi_understandability`, `kpi_security`) sont déjà partiellement visibles dans l'échantillon GraphQL existant (`temp/answer.txt`, ex. `kpi_functionalSuitability: ["UG_status_exist"]`) mais ne sont pas encore dans la requête ni le modèle `Application`.
- `deta06ComplianceLevel` et `deta06MissingDocs` sont de nouveaux champs (distincts de `deta06ComplianceStatus`, déjà utilisé par l'ancien radar 9 axes) — leur présence exacte dans le schéma GraphQL n'a pas encore été vérifiée sur un échantillon réel (voir Open Questions).

## Décisions (arbitrées)
- **5 axes**, chacun avec un libellé fixe :
  - `kpi_functionalSuitability` → **Suitability** (5 valeurs possibles : RTC, BRD, User Guide, Quality Doc, Project Plan)
  - `kpi_maintainability` → **Maintainability** (6 valeurs possibles : CI/CD, Source Code, QA Analysis, MyPortfolio Ref, Atom Ref, MyDataCompliance)
  - `kpi_understandability` → **Understandability** (4 valeurs possibles : ARD, Design Dossier, Release Note, ORS)
  - `kpi_security` → **Security** (1 valeur possible : Security validation — donc binaire 0% ou 100%)
  - `deta06ComplianceLevel` → **DETA 06** (pourcentage déjà fourni par le backend, pas de calcul de ratio à faire)
- **Calcul du pourcentage** pour les 4 premiers axes : `(nombre de valeurs présentes dans le champ multivalué) / (nombre de valeurs possibles pour ce champ)`, arrondi pour l'affichage. Le radar trace ces 5 pourcentages (y compris DETA06, déjà en pourcentage) sur une échelle 0-100% commune à tous les axes — remplace l'ancienne échelle 1-5.
- **Mapping valeur brute → libellé lisible**, un dictionnaire par champ (donné explicitement par l'utilisateur, ex. `RTC_status_exist` → "RTC", `BuildChain_status_exist` → "CI/CD", `rtc` → "RTC" pour `deta06MissingDocs`, etc.).
- **Tableau détaillé avec toggle Delivered/Missing** : pour chaque axe (sauf DETA06), le toggle change l'affichage entre la liste des valeurs présentes (labels des valeurs retournées) et la liste des valeurs manquantes (labels des valeurs possibles non retournées).
- **Cas particulier DETA06** : aucune liste "présents" n'est calculée ni affichée pour cet axe (le champ `deta06MissingDocs` ne donne que les manquants) — en mode Delivered, la ligne DETA06 est **absente** du tableau ; en mode Missing, elle affiche les libellés de `deta06MissingDocs`.
- **Remplacement, pas coexistence** : l'ancien radar à 9 axes et son mapping (`lib/compliance-score-mapping.json`, `lib/compliance-score.ts`) sont remplacés par cette nouvelle logique — voir Open Questions pour le sort exact des 7 attributs qualitatifs ajoutés lors de l'itération précédente.

## Requirements

### Functional Requirements
- L'onglet Compliance affiche un radar à 5 axes (Suitability, Maintainability, Understandability, Security, DETA 06), chaque axe sur une échelle de pourcentage (0-100%) commune.
- Un pourcentage par axe est calculé à partir du nombre de valeurs présentes sur le nombre de valeurs possibles, pour les 4 champs KPI multivalués ; `deta06ComplianceLevel` est utilisé directement comme pourcentage sans recalcul.
- Un toggle Delivered/Missing contrôle l'affichage du tableau détaillé : en Delivered, chaque axe (hors DETA06) liste les libellés des valeurs présentes ; en Missing, chaque axe liste les libellés des valeurs absentes (calculées par complément à l'ensemble des valeurs possibles), et DETA06 liste les libellés de `deta06MissingDocs`.
- En mode Delivered, la ligne DETA06 n'apparaît pas dans le tableau détaillé.
- Les libellés affichés (aussi bien pour les valeurs présentes/manquantes que pour les intitulés d'axes) suivent exactement le mapping fourni par l'utilisateur.

### Non-Functional Requirements
- **Pas de nouvel appel réseau supplémentaire** : les champs KPI et DETA06 sont ajoutés à la requête GraphQL déjà utilisée pour lire une Application.
- **Aucune valeur inventée** : une valeur brute reçue qui ne correspond à aucun libellé connu du dictionnaire doit être gérée sans faire échouer le calcul (voir Edge Cases).
- **Cohérence visuelle** avec le composant radar SVG déjà en place (rendu dessiné à la main, fonctionne même si l'onglet Compliance n'est pas actif au premier rendu).
- **Pas de régression** sur les autres onglets ni sur le reste de la fiche détail.

## Scope

### In Scope
- Extension de la requête GraphQL, du modèle `Application` et de l'adaptateur pour les 5 champs (`kpi_functionalSuitability`, `kpi_maintainability`, `kpi_understandability`, `kpi_security`, `deta06ComplianceLevel`, `deta06MissingDocs`).
- Recalcul du radar Compliance sur ces 5 axes en pourcentage, remplaçant le radar à 9 axes existant.
- Tableau détaillé avec toggle Delivered/Missing, y compris le traitement particulier de la ligne DETA06.
- Dictionnaires de libellés pour les valeurs des 4 champs KPI multivalués et pour `deta06MissingDocs`.

### Out of Scope
- Toute modification des autres onglets (Identity, Accountability, Documentation, In Context).
- La liste des autres attributs de conformité qualitatifs ajoutés par l'itération précédente (`securityAssesmtStatus`, `cyberSecurityLevel`, `businessSecurityLevel`, `ecCompliance`, `accessControlCompliance`, `deta06ComplianceStatus`, `mdcStatus`) — leur devenir (conservés en base pour un futur usage, ou retirés du modèle/requête) est à trancher en Open Questions, mais leur éventuelle réutilisation ailleurs n'est pas dans le périmètre de cette spec.
- Toute agrégation multi-applications (moyenne de conformité par portfolio, etc.).

## Affected Areas
- **Modifier** : `lib/leanix-application-query.ts` (ajout des 5 champs GraphQL), `lib/atom-api.ts` (`ApplicationNode` étendu), `lib/types.ts` (`Application` étendu), `lib/application-adapter.ts` (mapping des 5 nouveaux champs, valeurs multivaluées passées telles quelles en tableaux de chaînes).
- **Remplacer** : la logique de `lib/compliance-score-mapping.json`/`lib/compliance-score.ts` par une nouvelle logique de calcul de ratio + dictionnaires de libellés (nom de fichier/emplacement à déterminer lors du plan).
- **Réécrire** : `components/detail/ComplianceTab.tsx` (radar 5 axes en pourcentage, tableau détaillé avec toggle Delivered/Missing).
- **Non touché** : `IdentityTab`, `AccountabilityTab`, `DocumentationTab`, `Tabs.tsx`, board catalogue, `/map`, export PDF.

## Edge Cases
- Champ multivalué absent ou vide (aucune valeur retournée) → pourcentage 0%, toutes les valeurs possibles apparaissent en "manquant".
- Champ multivalué contenant une valeur brute non reconnue par le dictionnaire de libellés → ne doit pas fausser le calcul du pourcentage (compter la valeur comme présente si elle appartient bien à l'ensemble des valeurs possibles listées, l'ignorer sinon) ni faire échouer l'affichage (elle n'apparaît simplement dans aucune liste labellisée).
- `deta06ComplianceLevel` absent → axe DETA06 affiché comme "non renseigné" plutôt qu'un 0% ou une valeur inventée.
- `deta06MissingDocs` absent ou vide alors que `deta06ComplianceLevel` < 100% → incohérence possible entre le pourcentage et la liste de manquants ; comportement à définir (afficher le pourcentage sans liste, ou signaler l'absence de détail).
- `kpi_security` n'ayant qu'une seule valeur possible → le pourcentage est nécessairement 0% ou 100%, jamais une valeur intermédiaire.

## Open Questions
- **Nom exact et disponibilité de `deta06ComplianceLevel`/`deta06MissingDocs`** dans le schéma GraphQL réel : ces deux champs ne sont vus dans aucun échantillon existant (`temp/getApp.txt`/`answer.txt` n'avaient que `deta06ComplianceStatus`, un champ à 3 paliers, déjà utilisé par l'ancien radar). À vérifier avant implémentation. => pas visible mais ils existent bien.

- **Devenir des 7 attributs qualitatifs de l'ancien radar 9 axes** (`securityAssesmtStatus`, `cyberSecurityLevel`, `businessSecurityLevel`, `ecCompliance`, `accessControlCompliance`, `deta06ComplianceStatus`, `mdcStatus`) : les retirer de la requête GraphQL et du modèle `Application` (nettoyage, plus aucun composant ne les utiliserait), ou les garder en base pour un usage futur non encore spécifié ? => les retirer, en fait ses données seront intégrer dans l'une des 5 catégoris qui évolueront dans le futur

- **Seuils de sévérité visuelle** (couleurs good/warn/risk) pour les pourcentages du nouveau radar : reprendre les seuils déjà utilisés ailleurs sur la fiche (≥80 good, ≥50 warn, sinon risk, cf. l'anneau de complétion) ou définir des seuils propres à ce radar ? => reprendre les mêmes

- **Arrondi du pourcentage affiché** : entier le plus proche, ou une décimale ? => entier le plus proche arrondi à 5%.

- **`deta06MissingDocs` vide/incohérent avec `deta06ComplianceLevel`** (cf. Edge Cases) : comportement exact à trancher. => cette incogérence est normalement traité côté backend, donc pas de traitement à faire ici, s'il y a une incohérence ne pas s'en préocuper et la montrer

- **Emplacement du nouveau dictionnaire de libellés/valeurs possibles** : un unique fichier de ressource (à la manière de l'actuel `lib/compliance-score-mapping.json`) couvrant les 5 champs, ou une structure différente ? => un unique fichier de resource

## Acceptance Criteria
- [ ] L'onglet Compliance affiche un radar à 5 axes (Suitability, Maintainability, Understandability, Security, DETA 06) sur une échelle de pourcentage commune.
- [ ] Le pourcentage de chaque axe KPI est calculé comme le ratio valeurs présentes / valeurs possibles, avec les bons libellés d'axe et de valeur.
- [ ] `deta06ComplianceLevel` alimente directement l'axe DETA06 sans recalcul de ratio.
- [ ] Un toggle Delivered/Missing change l'affichage du tableau détaillé pour tous les axes KPI ; la ligne DETA06 n'apparaît qu'en mode Missing, listant les libellés de `deta06MissingDocs`.
- [ ] Aucune valeur inventée : un champ absent ou une valeur brute non reconnue ne fait pas échouer le rendu ni fausser silencieusement un pourcentage.
- [ ] Les 5 champs sont lus via la requête GraphQL existante, sans appel réseau supplémentaire.
- [ ] Aucune régression sur les autres onglets ni sur le reste de la fiche détail.
- [ ] Build Next OK (`npm run build`).
