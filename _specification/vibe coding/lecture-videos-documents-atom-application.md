# Feature Spec: Lecture Vidéos Documents ATOM — Application

## Summary
- La réponse REST `GET {ATOM_API_BASE_URL}/api/infos/applications/{externalId}` (et la liste) contient déjà un champ `documentRefs` (voir `_specification/vibe coding/nouveaux-attributs-rest-application.md` et `photos-labtestmeans-depuis-api.md` pour le précédent côté LabTestMean). Chaque élément a la forme `{ id, name, documentType, origin, url, code }`.
- Cette spec ajoute la capacité, sur la fiche détail `/application?id=<externalId>`, de repérer les `documentRefs` dont `documentType === "video"`, d'en afficher une **petite vignette/carte cliquable** sous les encarts existants, et — au clic — de **lire la vidéo dans l'encart principal** (la zone occupée aujourd'hui par la photo principale du carrousel `Gallery`, à gauche du formulaire).
- Remplace, pour l'usage réel par application, le test exploratoire fait sur la branche `testVideo` (iframe GDrive codée en dur pointant vers un unique lien fourni manuellement, présent aujourd'hui sur **toutes** les fiches détail) — ce test doit être **supprimé** lors de l'implémentation de cette spec. Ici, l'URL vidéo vient de la donnée réelle (`documentRefs[].url`) et peut différer par application.

## Motivation
- Le test précédent (branche `testVideo`) a validé qu'une iframe d'aperçu Google Drive (`/preview`) s'intègre proprement dans la mise en page de la fiche détail, avec un lien codé en dur affiché sur toutes les fiches — étape exploratoire, remplacée ici par une vraie donnée par application et destinée à être retirée du code.
- Le JSON réel d'une application (`temp/appInfo.jon`, échantillon "ATOM"/`7DAE`) montre un `documentRefs` contenant déjà une entrée `documentType: "video"` (ex. "ATOM in 1 min") avec une URL Google Drive vers un proxy interne (`drive.google.com.rproxy.goskope.com`), aux côtés d'autres types (`others`, `gdrive_reference`).
- **Correction par rapport à une première intuition** : contrairement aux photos (où l'API ressources ATOM `{ATOM_API_BASE_URL}/api/infos/resource` est interrogée pour récupérer le binaire de l'image), la vidéo n'est **pas** servie par cette API. `documentRef.url` est directement un lien vers la vidéo hébergée sur Google Drive, à streamer tel quel — exactement le mécanisme déjà validé par le test exploratoire (iframe `/preview`), mais avec l'URL réelle du document au lieu d'un lien codé en dur.

## Décisions (arbitrées)

### Source de données
- Les vidéos sont extraites de `documentRefs` (déjà présent dans `ApplicationDto`/`DocumentRef`, réutilisé tel quel depuis `lib/atom-api.ts` — même type que pour LabTestMean).
- Filtre : `documentType === "video"` (comparaison insensible à la casse, cohérent avec le filtre existant `documentType.toLowerCase() === "image"` utilisé pour les photos LTM).

### Lecture de la vidéo
- La vidéo n'est **pas** récupérée via l'API ressources ATOM (`{ATOM_API_BASE_URL}/api/infos/resource`) — celle-ci sert uniquement les photos. `documentRef.url` est directement l'URL Google Drive de la vidéo, à intégrer telle quelle via une iframe d'aperçu Google Drive (`.../preview`), sur le même principe que le test exploratoire de la branche `testVideo`, mais construite dynamiquement à partir de l'URL réelle du document au lieu d'un lien codé en dur.
- Aucun nouveau proxy Next / appel réseau côté serveur n'est nécessaire pour la lecture : l'iframe charge directement la ressource Google Drive depuis le navigateur, comme dans le test exploratoire.

### Robustesse de la conversion d'URL Google Drive
Trois leviers retenus, à implémenter ensemble :
1. **Convention à la saisie (documentée, non bloquante côté code)** : recommander, pour qui dépose la vidéo sur Drive et alimente ATOM, de partager le fichier en "Anyone with the link – Viewer" et de coller le lien tel que fourni par "Copy link" dans Drive. Réduit la variabilité des cas rencontrés, mais n'est pas une garantie technique (l'utilisateur peut coller un lien différent, ou le lien peut transiter par un proxy réseau).
2. **Extraction robuste de l'ID de fichier côté code** : une fonction dédiée (ex. `lib/gdrive.ts`) extrait l'ID via une regex sur le **chemin** de l'URL (`/file/d/([a-zA-Z0-9_-]+)/`), indépendamment du domaine (couvre `drive.google.com` et un domaine proxifié comme `drive.google.com.rproxy.goskope.com`) et du suffixe (`?usp=sharing`, `?usp=drive_link`, absent, ou déjà `.../preview`). L'iframe est toujours reconstruite avec le domaine canonique `https://drive.google.com/file/d/<id>/preview`, cohérent avec les autres liens Google déjà affichés bruts ailleurs sur la fiche (`ARDURL`, `confluenceURL`).
3. **Repli si l'extraction échoue** : si aucune correspondance `/file/d/<id>/` n'est trouvée dans `documentRef.url` (lien non-Google-Drive, ou format inattendu), ne pas tenter d'iframe — afficher à la place un simple lien cliquable "Ouvrir la vidéo" (`target="_blank"`) vers l'URL brute. Pas de page cassée sur une donnée mal saisie.

### Emplacement et interaction
- Une petite vignette/carte "vidéo" par `documentRef` vidéo trouvé, affichée **sous les petits encarts existants** de la fiche détail (zone des informations complémentaires / managers), pas dans le carrousel `Gallery` lui-même.
- Au clic sur une vignette, la vidéo se lit **dans l'encart principal** — la zone aujourd'hui occupée par l'image principale du carrousel (`Gallery`, à gauche du formulaire) — en remplacement temporaire de la photo affichée.
- Un mécanisme de retour à l'affichage photo (fermeture du mode vidéo) est nécessaire mais son déclencheur exact (bouton fermer, reclic sur une vignette photo, etc.) n'est pas tranché — voir Open Questions.

## Requirements

### Functional Requirements
- Extraire, pour une application donnée, la liste des `documentRefs` dont `documentType` vaut `video` (insensible à la casse).
- Afficher une vignette/carte par vidéo trouvée, sous les encarts existants de la fiche détail, avec au minimum le nom du document (`documentRef.name`) et un indicateur visuel qu'il s'agit d'une vidéo.
- Au clic sur une vignette vidéo, afficher dans l'encart principal (zone actuelle de l'image du carrousel) une iframe d'aperçu Google Drive dont l'ID de fichier est extrait de `documentRef.url` (extraction robuste, indépendante du domaine/suffixe — voir Décisions), reconstruite en `https://drive.google.com/file/d/<id>/preview`.
- Si l'ID ne peut pas être extrait de `documentRef.url` (format non reconnu), afficher un lien cliquable "Ouvrir la vidéo" vers l'URL brute à la place de l'iframe.
- Permettre de revenir à l'affichage normal du carrousel photo après consultation de la vidéo (clic sur une autre vignette).
- Aucune vidéo trouvée pour une application → aucune vignette affichée, aucun changement visuel par rapport à l'état actuel de la fiche.

### Non-Functional Requirements
- **Réutilisation du mécanisme déjà validé** : la lecture de la vidéo reprend le principe de l'iframe Google Drive `/preview` du test exploratoire (branche `testVideo`), appliqué à l'URL réelle du `documentRef` plutôt qu'à un lien codé en dur. Pas de nouveau proxy Next, pas d'appel à l'API ressources ATOM pour les vidéos.
- **Pas de régression** sur le carrousel photo existant (`Gallery`) ni sur les sections déjà affichées de la fiche détail.
- **Tolérance à l'absence de données** : `documentRefs` absent, vide, ou sans entrée `video` → comportement actuel inchangé (pas d'erreur, pas de zone vide visible).
- Le chargement de l'iframe Google Drive se fait depuis le navigateur au moment du rendu, comme pour le test exploratoire déjà accepté — cohérent avec la règle CLAUDE.md "Network calls — ask first" (pas d'appel outillé déclenché par le code assistant).

## Scope

### In Scope
- Détection des `documentRefs` de type vidéo pour les Applications, sur la fiche détail uniquement.
- Affichage d'une/plusieurs vignette(s) cliquable(s) sous les encarts existants.
- Lecture de la vidéo dans l'encart principal au clic, via iframe Google Drive pointant sur l'URL réelle du document.
- Retour à l'affichage photo standard après consultation vidéo.
- Suppression du test exploratoire GDrive codé en dur (iframe statique visible sur toutes les fiches, branche `testVideo`) — remplacé par ce mécanisme piloté par la donnée.

### Out of Scope
- Board catalogue (`ApplicationCard.tsx`) et `/map` : pas d'indicateur vidéo sur les cartes de la grille ni sur la carte.
- Export PDF (`components/pdf/*`) : pas d'inclusion de vidéo.
- Intégration de la vidéo comme slide à part entière du carrousel `Gallery` (mélangée aux photos) — piste évoquée dans une discussion précédente, non retenue ici (l'affichage se fait en remplacement temporaire de l'encart principal, pas comme un slide supplémentaire du carrousel).
- Autres `documentType` (`others`, `gdrive_reference`, `pdf`, etc.) — non concernés par cette spec.
- Support d'autres hébergeurs vidéo que Google Drive (le mécanisme `/preview` est spécifique à Google Drive).

## Affected Areas
- **Réutilisé sans modification** : `DocumentRef` (`lib/atom-api.ts`), déjà présent dans `ApplicationDto.documentRefs`.
- **Modifier** : `lib/types.ts` / `lib/application-adapter.ts` pour exposer les vidéos extraites à l'UI (nouveau champ dérivé, ex. liste de vidéos par application).
- **Modifier** : `components/ApplicationDetailClient.tsx` et/ou `components/Gallery.tsx` pour l'affichage des vignettes et la bascule de l'encart principal en mode lecture vidéo (iframe Google Drive, reprenant le gabarit visuel déjà utilisé dans le test exploratoire : `relative aspect-video bg-surface-2 rounded-card overflow-hidden`).
- **Supprimer** : le bloc de test exploratoire codé en dur dans `components/ApplicationDetailClient.tsx` (section "Video (test)" avec l'iframe pointant sur l'unique lien GDrive fourni manuellement) — remplacé par le mécanisme piloté par `documentRefs`.
- **Non touché** : board catalogue, `/map`, export PDF, autres types de documents, `lib/usePhoto.ts`/proxy ressources (mécanisme photo inchangé, non réutilisé pour la vidéo).

## Edge Cases
- Plusieurs `documentRefs` de type vidéo pour une même application → toutes affichées comme vignettes distinctes ; l'encart principal affiche la dernière vidéo cliquée.
- `documentRefs` absent ou `null` (backend n'a pas encore peuplé ce champ, ou application sans documents) → aucune vignette, comportement actuel inchangé.
- URL vidéo invalide, document supprimé côté source, ou fichier Google Drive non partagé ("Anyone with the link") → la vignette reste visible ; l'iframe peut afficher l'écran de demande d'accès de Google Drive (comportement attendu du côté Google, pas un bug de l'application).
- URL du `documentRef` qui n'est pas un lien Google Drive reconnu (pas de segment `/file/d/<id>/` dans le chemin) → pas d'iframe, repli sur un lien cliquable "Ouvrir la vidéo" vers l'URL brute (voir Décisions, levier 3).
- URL Google Drive avec un domaine proxifié (ex. `drive.google.com.rproxy.goskope.com`, observé dans l'échantillon réel) → l'extraction basée sur le chemin (pas sur le nom d'hôte) doit fonctionner malgré tout.
- Nom de document vidéo manquant ou vide → libellé de repli générique sur la vignette (ex. "Vidéo").

## Open Questions
- **Vignette vidéo** : doit-elle afficher une miniature générée (frame extraite, non disponible ici) ou une icône/pictogramme générique "vidéo" avec le nom du document ? => pour l'instant pictogramme générique vidéo avec le nom de documents.

- **Plusieurs vidéos** : si une application a plusieurs `documentRefs` vidéo, faut-il une vignette par vidéo (rangée de petites cartes) ou un sélecteur unique (menu déroulant) ? => il faut plusieurs finettes vidéo comme pour les photos.
@temp/e4
## Acceptance Criteria
- [ ] Les `documentRefs` de type `video` sont correctement identifiés et exposés à l'UI de la fiche détail Application.
- [ ] Une vignette cliquable apparaît sous les encarts existants pour chaque vidéo trouvée.
- [ ] Le clic sur une vignette affiche la vidéo dans l'encart principal (zone actuelle de l'image du carrousel), via une iframe Google Drive `.../preview` dont l'ID est extrait de `documentRef.url` indépendamment du domaine/suffixe.
- [ ] Une URL sans segment `/file/d/<id>/` reconnu affiche un lien "Ouvrir la vidéo" au lieu d'une iframe cassée.
- [ ] Cliquer sur une autre vignette (photo ou vidéo) fait revenir/change l'affichage de l'encart principal en conséquence.
- [ ] Une application sans `documentRefs` vidéo n'affiche aucune vignette et ne présente aucune régression visuelle.
- [ ] Le bloc de test exploratoire codé en dur ("Video (test)") est supprimé de `ApplicationDetailClient.tsx`.
- [ ] Build Next OK, pas de régression sur le carrousel photo existant ni sur les autres sections de la fiche détail.
