# Feature Spec: Correction Détection Documents (Vidéo/Slides/Photo) et Cache Photos

## Summary
- Clarifie et corrige la façon dont chaque `documentRef` d'une Application est classé, en fonction des vraies valeurs `documentType`/`origin`/forme d'URL observées côté backend :
  - **Vidéo** : `documentType: "video"`, `origin: "CUSTOM_LINK"`, URL Google Drive vers un fichier (`/file/d/...`).
  - **GSlide / GSheet** : **mêmes** `documentType: "video"` et `origin: "CUSTOM_LINK"` que la vidéo — la distinction ne peut se faire **que par la forme de l'URL** (`/presentation/...`, `/spreadsheets/...`, `/document/...`).
  - **Photo** : `documentType: "photo"` (pas `"image"`), `origin: "LX_STORAGE_SERVICE"`, contenu binaire hébergé sur LeanIX et récupéré via l'API ressources ATOM (`POST /api/infos/resource`), pas un lien externe.
- Aligne l'implémentation actuelle de `7DAE-app-dashboard` sur ces clarifications, et reprend pour l'affichage des vignettes photo la solution déjà en place et validée dans `7DAE-ltm-dashboard` (cache persistant + état de chargement pendant l'appel ressource, souvent lent).

## Motivation
- L'implémentation actuelle de la fiche Application filtre les photos sur `documentType?.toLowerCase() === "image"`. Cette valeur n'a jamais été observée dans un vrai payload ; la clarification confirme que la valeur réelle est `"photo"`. Sans correction, aucune photo réelle ne sera jamais détectée même quand le backend en fournit.
- Un incident précédent (vignette "ATOM overview" affichée comme lien de repli au lieu d'un Slides intégré) a révélé que `documentType: "video"` est utilisé indifféremment pour une vraie vidéo Drive **et** pour un Slides/Sheets — ce n'est pas une erreur de saisie côté backend mais un comportement confirmé par cette clarification. La détection par forme d'URL (déjà mise en place en priorité sur `documentType` suite à cet incident) est donc la bonne approche à long terme, pas un contournement temporaire.
- `7DAE-ltm-dashboard` a déjà résolu, pour les LabTestMeans, le même problème d'affichage de vignettes photo issues de l'API ressources ATOM : un appel `POST /api/infos/resource` peut prendre 5 à 30 secondes, donc l'implémentation there ajoute un cache persistant (IndexedDB) partagé entre le catalogue, la fiche détail et l'export PDF, plus un état de chargement explicite pour afficher un indicateur pendant l'attente. `7DAE-app-dashboard` n'a aujourd'hui qu'un appel direct sans cache ni indicateur de chargement — à aligner sur la solution déjà éprouvée.

## Décisions (arbitrées)

### Discrimination des types de documents
- **Vidéo vs Slides/Sheets/Docs** : ne jamais se fier à `documentType` seul pour ces deux cas (valeur identique `"video"`). La forme de l'URL est le signal décisif et prioritaire ; `documentType`/`origin` ne servent que de repli quand l'URL ne correspond à aucun format Google reconnu.
- **Photo** : le filtre de détection des photos doit reconnaître `documentType: "photo"` (correction — l'implémentation actuelle utilise à tort `"image"`).
- `origin` (`CUSTOM_LINK` pour vidéo/Slides/Sheets, `LX_STORAGE_SERVICE` pour les photos) est un signal corroborant supplémentaire disponible dans la réponse REST, non encore modélisé dans le DTO frontend — à ajouter pour fiabiliser la classification et documenter l'intention, même si la détection par URL/documentType reste suffisante seule dans les cas connus à ce jour.

### Affichage des photos — alignement sur `7DAE-ltm-dashboard`
- Reprendre le mécanisme déjà en place et validé dans `7DAE-ltm-dashboard` pour les vignettes photo issues de l'API ressources ATOM :
  - Cache persistant (navigateur) du contenu binaire déjà récupéré, partagé entre toutes les vues qui affichent la même photo, pour éviter de re-déclencher l'appel ressource (lent) à chaque navigation.
  - Un réglage utilisateur pour activer/désactiver ce cache et borner sa taille.
  - Un état de chargement explicite exposé par le hook de récupération de photo, pour que l'UI puisse afficher un indicateur pendant l'attente (l'appel ressource peut prendre 5 à 30 secondes) plutôt qu'un vide silencieux.

## Requirements

### Functional Requirements
- Le DTO Application (`documentRefs`) reconnaît et expose le champ `origin` en plus de `documentType`/`url`/`name`/`id` déjà présents.
- La détection des photos filtre sur `documentType === "photo"` (au lieu de `"image"`), avec tolérance de casse comme les autres filtres existants.
- La détection vidéo/Slides/Sheets reste pilotée en priorité par la forme de l'URL, cohérente avec le comportement déjà en place suite à l'incident "ATOM overview" — cette spec documente ce choix comme définitif plutôt que comme un contournement.
- L'affichage des vignettes et de l'image principale issues de photos ATOM utilise un mécanisme de cache persistant et un état de chargement, sur le modèle de `7DAE-ltm-dashboard` (`lib/usePhoto.ts`, `lib/photoCacheDb.ts`, `lib/photoCacheSettings.ts`).

### Non-Functional Requirements
- Aucune régression sur la détection vidéo/Slides/Sheets déjà en place (comportement inchangé, seulement documenté/confirmé).
- Le cache photo doit rester dégradable proprement : navigateur sans support IndexedDB, cache désactivé par l'utilisateur, ou quota dépassé → l'affichage retombe sur un appel direct à l'API ressources, comme c'est le cas aujourd'hui.
- Pas de nouvel appel réseau introduit par cette clarification en elle-même (les appels à l'API ressources existent déjà) ; toute vérification contre le backend réel reste soumise à la règle CLAUDE.md "Network calls — ask first".

## Scope

### In Scope
- Correction du filtre de détection des photos (`"image"` → `"photo"`).
- Ajout du champ `origin` au DTO `documentRefs`, utilisé comme signal corroborant.
- Portage du mécanisme de cache persistant + état de chargement pour les photos depuis `7DAE-ltm-dashboard` vers `7DAE-app-dashboard`.
- Documentation/confirmation du comportement de détection vidéo/Slides/Sheets déjà implémenté (pas de changement de logique, seulement de statut : définitif et non plus provisoire).

### Out of Scope
- Réglages UI avancés du cache (l'écran de préférences existant dans `7DAE-ltm-dashboard`, si non déjà présent dans `7DAE-app-dashboard`, n'est pas nécessairement à répliquer à l'identique — voir Open Questions).
- Export PDF, board catalogue au-delà de la couverture déjà affichée, `/map` — non concernés au-delà de l'usage déjà existant du cache pour ces vues dans `7DAE-ltm-dashboard`.
- Nouveaux types de documents au-delà de vidéo/Slides/Sheets/Docs/photo.

## Affected Areas
- **Modifier** : DTO `documentRefs` (ajout `origin`).
- **Modifier** : logique d'extraction des photos (filtre `documentType`).
- **Créer/Porter** : mécanisme de cache persistant + état de chargement pour les photos, sur le modèle de `7DAE-ltm-dashboard` (`lib/usePhoto.ts`, `lib/photoCacheDb.ts`, `lib/photoCacheSettings.ts`).
- **Non touché** : logique de détection vidéo/Slides/Sheets par URL (déjà correcte, confirmée par cette spec).

## Edge Cases
- Un `documentRef` avec `documentType: "photo"` mais `origin` différent de `LX_STORAGE_SERVICE` (cas non observé mais possible) → comportement à trancher (voir Open Questions).
- Cache photo plein ou navigateur en navigation privée (IndexedDB indisponible) → dégradation propre vers l'appel direct, sans erreur visible.
- Photo dont l'appel ressource échoue ou dépasse un délai raisonnable → état de chargement ne doit pas rester bloqué indéfiniment (comportement à aligner sur `7DAE-ltm-dashboard`).

## Open Questions
- Faut-il répliquer également l'écran de réglages utilisateur du cache photo (activer/désactiver, taille max) dans `7DAE-app-dashboard`, ou seulement le mécanisme de cache lui-même avec des valeurs par défaut fixes ? => oui tu peux le répliquer.


- `origin` doit-il devenir un filtre bloquant (ex. ignorer une photo si `origin !== "LX_STORAGE_SERVICE"` même si `documentType === "photo"`), ou rester un signal informatif non bloquant tant qu'aucune donnée réelle ne contredit `documentType` ? => oui filtre bloquant

- Le comportement en cas d'échec/lenteur excessive de l'API ressources (au-delà de l'indicateur de chargement) doit-il inclure un message d'erreur explicite ou un bouton de nouvelle tentative ? => non

## Acceptance Criteria
- [ ] Les `documentRefs` de type `photo` (et non plus `image`) sont correctement détectés et alimentent `coverPhoto`/`photos` de l'Application.
- [ ] Le champ `origin` est disponible sur chaque `documentRef` côté frontend.
- [ ] L'affichage d'une photo ATOM montre un état de chargement pendant l'appel ressource, et réutilise un contenu déjà récupéré sans re-déclencher l'appel, sur le modèle de `7DAE-ltm-dashboard`.
- [ ] La détection vidéo/Slides/Sheets par forme d'URL continue de fonctionner sans régression.
- [ ] Build Next OK, pas de régression sur les sections existantes de la fiche détail Application.
