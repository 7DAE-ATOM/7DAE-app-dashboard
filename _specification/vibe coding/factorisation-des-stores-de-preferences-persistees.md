# Feature Spec: Factorisation des Stores de Préférences Persistées

## Summary
- Le dashboard compte aujourd'hui **huit** stores construits sur `useSyncExternalStore`, écrits à la main, en trois familles :
  1. **Famille A — le DOM comme source de vérité** (`lib/useTheme.ts`, `lib/catalogueDensity.ts`) : la valeur vit dans un attribut de `<html>`, écrite avant la première peinture par le script anti-FOUC de `app/layout.tsx`, et React s'y abonne par `MutationObserver`.
  2. **Famille B — état de module + ensemble de listeners** (`lib/photoCacheSettings.ts`, `lib/discoverDisplaySettings.ts`, `lib/discoverViewMode.ts`, `lib/filterSectionState.ts`, `lib/appFilters.ts`) : cinq stores qui répètent la même plomberie.
  3. **Cas particulier** (`lib/discoverEdgeCurvature.ts`) : listeners indexés **par id d'arête**, non persisté — hors sujet ici.
- Cette spec ne remet **pas** en cause la partition A / B : elle repose sur un critère réel (la valeur doit-elle être correcte *avant* hydratation et être lisible par le CSS ?). Elle demande en revanche que ce critère devienne une **règle écrite** au lieu d'un commentaire isolé dans un seul fichier.
- Le sujet est la **famille B** : extraire sa plomberie commune dans une fabrique unique, sous `lib/`, et réécrire les stores concernés comme de simples déclarations — clé, niveau de stockage, valeur par défaut, fonction de validation.
- La fabrique devient l'endroit unique où sont tenues trois garanties aujourd'hui répétées ou absentes : identité stable du snapshot, instantané serveur constant, et **synchronisation entre onglets**, qui n'existe nulle part actuellement.
- Refactor **à comportement constant** : aucune préférence ne change de valeur par défaut, de clé de stockage, de niveau de stockage ni d'API publique vue par les composants.
- Aucune bibliothèque de state management n'est introduite.

## Motivation
- **La duplication est réelle et mesurable.** Les stores de la famille B répètent chacun le même bloc — état de module, drapeau d'hydratation, ensemble de listeners, fonction d'émission, `subscribe`, `getSnapshot`, `getServerSnapshot`, écriture protégée par `try/catch`. Environ 240 lignes de plomberie pour une soixantaine de lignes de valeur métier.
- **Elle a déjà divergé**, comme toute copie manuelle :
  - deux orthographes du même test d'environnement (`typeof window === "undefined"` d'un côté, `globalThis.window === undefined` de l'autre) ;
  - la lecture non-réactive hors de React n'existe que dans deux stores sur cinq, alors qu'elle est gratuite ;
  - l'invariante d'**identité du snapshot** — le piège classique de `useSyncExternalStore`, qui boucle à l'infini si la lecture retourne un objet neuf à chaque appel — est tenue à la main dans chaque store, explicitement gardée dans un seul fichier et seulement implicite dans les autres.
- **Une fonctionnalité manque partout à la fois** : aucun store n'écoute l'événement `storage`. Deux onglets ouverts sur l'application divergent silencieusement, et le dernier qui écrit gagne au rechargement suivant. Ajouter cela à la main dans cinq fichiers, c'est cinq occasions de se tromper ; dans une fabrique, c'est une fois.
- **La documentation affirme le contraire sur ce point précis.** L'en-tête de `lib/useTheme.ts` annonce qu'une écriture externe, « par exemple depuis un autre onglet via l'événement storage », est reflétée partout. Rien n'écoute `storage` dans le codebase : un lecteur qui s'appuie sur cette phrase construira faux.
- **Le prochain store est déjà prévisible.** Chaque itération récente a ajouté une préférence : densité du catalogue, cache photos, réglages Discover, courbure des liens, chapitres de filtres dépliés. Le suivant doit être une déclaration de dix lignes, pas une copie de plus.
- **Le coût de l'inaction est faible mais croissant, celui de l'action est faible et unique.** C'est le bon moment, tant que les stores concernés restent lisibles d'un seul coup d'œil.

## Requirements

### Functional Requirements

#### Une fabrique de store persistant
- Un module unique sous `lib/` expose une fabrique produisant, pour une préférence donnée, tout ce dont les composants ont besoin :
  - un **hook de lecture réactif**, utilisable dans n'importe quel composant client ;
  - une **lecture non-réactive**, pour le code appelé hors du rendu React ;
  - une **écriture**, qui met à jour l'état, persiste et notifie les abonnés.
- La fabrique est paramétrée par : la **clé de stockage**, le **niveau de stockage** (durable ou limité à l'onglet), la **valeur par défaut**, et une **fonction de validation** qui transforme la valeur persistée en valeur typée.
- La fabrique est **générique et typée** : le type de la valeur se propage au hook, à la lecture et à l'écriture sans assertion de type dans le code appelant.
- Pour les valeurs qui ne sont pas directement sérialisables — le cas de l'ensemble des chapitres de filtres dépliés — la fabrique accepte une **sérialisation explicite** en plus de la validation.

#### Ce que la fabrique prend en charge
- **Hydratation paresseuse** : la valeur persistée n'est lue qu'au premier abonnement ou à la première lecture, jamais au chargement du module. L'import doit rester sans effet de bord, y compris côté serveur.
- **Instantané serveur constant** : une référence stable, identique d'un appel à l'autre, pour que le rendu serveur et la première peinture client coïncident.
- **Identité du snapshot** : une nouvelle référence n'est produite **que** lorsqu'une valeur a réellement changé. Cette garantie est tenue par la fabrique, plus par chaque store.
- **Persistance tolérante aux pannes** : stockage indisponible (navigation privée, stockage bloqué), valeur corrompue ou quota dépassé n'interrompent jamais l'exécution ; le réglage retombe sur le défaut ou reste valable pour la durée de la page, sans message d'erreur.
- **Notification des abonnés** après chaque écriture, sans re-rendu des composants qui n'utilisent pas ce store.

#### Synchronisation entre onglets
- Les stores adossés au stockage durable se synchronisent entre onglets de la même origine : une écriture dans un onglet est reflétée dans les autres sans rechargement.
- La valeur reçue d'un autre onglet passe par **la même fonction de validation** que la valeur relue au démarrage : un onglet ne fait pas davantage confiance à un autre qu'au stockage lui-même.
- La synchronisation est **réglable par store**, pas imposée : un store peut légitimement rester local à son onglet.
- Le store des filtres, adossé au stockage d'onglet, n'est pas concerné — ce niveau de stockage est par nature propre à l'onglet.

#### Ce que la fabrique ne prend pas en charge
- La **validation métier de chaque préférence reste écrite explicitement, store par store**. C'est la partie qui porte la valeur, et elle diffère franchement d'un cas à l'autre : validation champ par champ des réglages d'affichage Discover, bornage de la taille du cache photos, filtrage sur la liste des chapitres connus, contrôle de forme des filtres. Aucune de ces règles ne doit être remplacée par une désérialisation aveugle.
- Les **valeurs par défaut**, les **clés de stockage** et le **choix du niveau de stockage** restent déclarés dans le module de chaque préférence, avec le commentaire qui les justifie.
- Les **noms métier** des fonctions exposées restent ceux d'aujourd'hui : chaque module continue de publier une API à son vocabulaire, pas une API générique.

#### Réécriture des stores de la famille B
- Les modules concernés sont réécrits au-dessus de la fabrique en conservant **exactement** leur surface publique actuelle : mêmes noms de hooks, de lecteurs et d'écrivains, mêmes signatures, mêmes types.
- Aucun composant consommateur n'est modifié. Si un composant doit changer, c'est que la surface publique a bougé et que le refactor a dépassé son périmètre.
- Les clés de stockage sont **inchangées** : une préférence enregistrée avant la mise à jour est relue après, sans réinitialisation.
- Les écritures partielles existantes — mise à jour d'un seul champ d'un objet de réglages, bascule d'un seul chapitre — sont conservées telles quelles, exprimées au-dessus de l'écriture générique.

#### Formalisation des deux niveaux
- La règle qui décide de la famille est écrite dans `CLAUDE.md`, en une phrase opérationnelle : une préférence vit dans le DOM **si et seulement si** elle doit être correcte avant hydratation ou être lisible par le CSS ; sinon elle passe par la fabrique.
- Les deux stores de la famille A sont annotés d'un renvoi à cette règle, pour qu'un lecteur comprenne qu'ils sont une exception motivée et non un héritage.
- Le commentaire de `lib/useTheme.ts`, qui décrit une synchronisation entre onglets inexistante, est corrigé : soit l'affirmation est retirée, soit elle est rendue vraie.

### Non-Functional Requirements
- **Aucune dépendance ajoutée.** La plateforme suffit : abonnement à un store externe, stockage navigateur, événement `storage`. Introduire une bibliothèque de state management pour remplacer une soixantaine de lignes serait un mauvais échange.
- **Comportement strictement constant** du point de vue de l'utilisateur : aucune préférence ne change de valeur, de moment d'application ni de durée de vie.
- **Aucune régression de première peinture** : les préférences de la famille A continuent d'être appliquées par le script anti-FOUC avant hydratation ; celles de la famille B continuent de rendre leur défaut puis la valeur persistée, comme aujourd'hui.
- **Bilan de lignes attendu** : plusieurs centaines de lignes de plomberie supprimées, remplacées par une fabrique de la taille d'un seul store actuel.
- **Vérifiabilité** : le refactor doit être entièrement couvert par le contrôle de types ; un changement de signature involontaire doit casser la compilation plutôt que se manifester à l'exécution.
- **Frontière client/serveur préservée** : les modules concernés restent des modules client, sans accès aux API navigateur au moment de l'import.

## Scope

### In Scope
- Création d'un module de fabrique de store persistant sous `lib/`.
- Réécriture au-dessus de cette fabrique de : réglages du cache photos, réglages d'affichage Discover, mode de vue Discover, chapitres de filtres dépliés, store des filtres du catalogue.
- Ajout de la synchronisation entre onglets pour les stores adossés au stockage durable.
- Correction du commentaire de `lib/useTheme.ts` sur la propagation entre onglets.
- Ajout dans `CLAUDE.md` de la règle de choix entre les deux niveaux, et renvoi depuis les deux stores de la famille A.

### Out of Scope
- **Migration de la famille A vers la fabrique.** Le thème et la densité du catalogue gardent le DOM pour source de vérité : c'est ce qui leur permet d'être justes dès la première peinture.
- **`lib/discoverEdgeCurvature.ts`.** Listeners par id d'arête, volontairement non persisté : ce n'est pas une copie du même patron, c'est un autre problème.
- **Introduction d'une bibliothèque de state management.**
- **Persistance serveur** des préférences, ou synchronisation entre navigateurs et entre utilisateurs.
- **Changement de niveau de stockage** d'une préférence existante — notamment le passage des filtres d'un stockage d'onglet à un stockage durable, qui serait une décision produit et non un refactor.
- **Modification des valeurs par défaut**, des clés de stockage ou des règles de validation existantes.
- **Refonte des composants consommateurs** : panneau de réglages, bascule de thème, barre d'outils Discover, panneau de filtres restent inchangés.
- **Migration des valeurs déjà persistées** chez les utilisateurs : les formats et les clés ne changent pas, il n'y a donc rien à migrer.
- **Ajout de nouvelles préférences** à l'occasion du refactor.

## Affected Areas
- **Créer** :
  - Un module de fabrique de store persistant sous `lib/`, avec l'en-tête qui explique ce qu'il garantit et ce qu'il laisse volontairement à chaque appelant.
- **Modifier** :
  - `lib/photoCacheSettings.ts` — réécrit sur la fabrique ; conserve son bornage de taille et sa lecture non-réactive, utilisée hors de React par le récupérateur de photos.
  - `lib/discoverDisplaySettings.ts` — réécrit ; conserve sa validation champ par champ, notamment le contrôle de la courbure, dont une valeur corrompue atteindrait le tracé des liens.
  - `lib/discoverViewMode.ts` — réécrit ; conserve son défaut et le motif documenté de ce défaut.
  - `lib/filterSectionState.ts` — réécrit ; conserve sa sémantique « on stocke les chapitres ouverts » et son filtrage sur les chapitres connus, avec la sérialisation explicite de l'ensemble.
  - `lib/appFilters.ts` — réécrit sur la fabrique pour sa partie persistée, en gardant son niveau de stockage d'onglet et le raisonnement qui le justifie. Attention : ce module porte aussi de l'état **non persisté** — page courante, jeton de réinitialisation — qui doit rester tel quel.
  - `lib/useTheme.ts` — commentaire corrigé, mécanisme inchangé.
  - `lib/catalogueDensity.ts` — renvoi à la règle des deux niveaux, mécanisme inchangé.
  - `CLAUDE.md` — la règle de choix entre les deux niveaux.
- **Non touché** :
  - Tous les composants consommateurs : la surface publique des stores ne bouge pas.
  - Le script anti-FOUC de `app/layout.tsx`.
  - `lib/discoverEdgeCurvature.ts`.
  - La couche API, les adapters, la logique de filtrage.

## Edge Cases
- **Stockage indisponible** (navigation privée, stockage bloqué par la politique du navigateur) : lecture et écriture échouent silencieusement, le réglage reste valable pour la durée de la page. Comportement identique à l'actuel.
- **Quota dépassé à l'écriture** : la valeur s'applique en mémoire et est notifiée aux abonnés même si la persistance échoue. Un réglage qui refuserait de s'appliquer parce que le stockage est plein serait pire que le défaut qu'il corrige.
- **Valeur persistée corrompue ou de forme inattendue** : retour au défaut, sans message d'erreur ni entrée de console bruyante.
- **Valeur persistée par une version antérieure**, comportant des champs disparus ou dépourvue de champs ajoutés depuis : chaque champ manquant retombe sur son défaut, les champs inconnus sont ignorés.
- **Écriture depuis un autre onglet** : la valeur reçue est revalidée avant d'être adoptée ; une valeur invalide venue d'un autre onglet ne peut pas corrompre celui-ci.
- **Événement `storage` portant une suppression** (clé effacée, stockage vidé depuis les outils du navigateur) : retour au défaut, pas de plantage.
- **Deux onglets écrivant quasi simultanément** : le dernier écrivain gagne, sans fusion. Aucune tentative de résolution de conflit — ce sont des préférences, pas des données.
- **Onglet ouvert par duplication** : le stockage d'onglet est copié à la duplication, donc les filtres sont hérités puis évoluent indépendamment. Comportement actuel, conservé.
- **Premier rendu et hydratation** : l'instantané serveur doit rester strictement égal au premier instantané client, faute de quoi React signale une incohérence d'hydratation.
- **Store lu hors de React** : l'hydratation doit se déclencher sur cette lecture aussi, pas seulement au premier abonnement.
- **Import du module côté serveur** : aucun accès aux API navigateur au chargement ; seule la valeur par défaut est observable.
- **Désabonnement du dernier consommateur** : l'écoute de l'événement `storage` est libérée, sans fuite d'écouteur lors de montages et démontages répétés d'une page.

## Open Questions
- **Synchronisation entre onglets : active par défaut ou déclarée store par store ?** Recommandation : active par défaut pour les stores à stockage durable, avec possibilité de la désactiver — une préférence d'affichage a vocation à suivre l'utilisateur d'un onglet à l'autre. => suivre recommendation

- **Les filtres du catalogue doivent-ils se synchroniser entre onglets ?** Deux onglets ouverts sur deux périmètres différents est un usage légitime, et ils sont en stockage d'onglet. Recommandation : non, ne rien changer. => suivre recommendation

- **Le thème doit-il, lui, se synchroniser entre onglets ?** C'est la promesse que son commentaire fait déjà à tort, et la seule préférence pour laquelle la divergence entre onglets se voit immédiatement. Recommandation : oui, rendre la phrase vraie plutôt que la retirer — c'est un ajout d'une dizaine de lignes dans la bascule de thème, indépendant du reste du refactor. => suivre recommendation

- **Faut-il faire passer la moitié « persistance » de la famille A par la fabrique**, en gardant le DOM pour la lecture ? Recommandation : non en première intention — le gain est mince et le risque porte sur le chemin critique de la première peinture. => suivre recommendation

- **Le refactor doit-il être livré d'un bloc ou store par store ?** Recommandation : fabrique et premier store migrés ensemble, les autres ensuite, pour que la fabrique soit validée par un cas réel avant d'être généralisée. => suivre recommendation

- **Faut-il en profiter pour uniformiser le nommage des écrivains** (écriture unitaire, écriture partielle par clé, bascule) ? Recommandation : non — ces noms décrivent des gestes métier différents, et les uniformiser toucherait les composants, ce que cette spec s'interdit. => suivre recommendation

## Acceptance Criteria
- [ ] Un module de fabrique unique existe sous `lib/` et produit, pour une préférence donnée, un hook de lecture réactif, une lecture non-réactive et une écriture, tous typés sans assertion côté appelant.
- [ ] Les stores de préférences de la famille B et le store des filtres sont réécrits au-dessus de cette fabrique.
- [ ] La plomberie dupliquée — état de module, drapeau d'hydratation, ensemble de listeners, émission, abonnement, lecture, instantané serveur, `try/catch` de persistance — n'apparaît plus qu'une fois dans le codebase.
- [ ] La validation propre à chaque préférence est toujours écrite explicitement dans son module : bornage de la taille du cache photos, contrôle champ par champ des réglages Discover, filtrage des chapitres de filtres connus, contrôle de forme des filtres.
- [ ] Aucun composant consommateur n'a été modifié, et la surface publique de chaque store — noms, signatures, types — est identique à celle d'avant.
- [ ] Les clés et les niveaux de stockage sont inchangés : une préférence enregistrée avant la mise à jour est relue correctement après, sans réinitialisation.
- [ ] Une écriture dans un onglet est reflétée dans un autre onglet ouvert sur l'application, sans rechargement, pour les stores concernés.
- [ ] Une valeur invalide reçue par l'événement `storage` est rejetée au profit du défaut, sans erreur visible.
- [ ] Stockage indisponible, valeur corrompue ou quota dépassé ne produisent ni plantage ni message à l'utilisateur ; le réglage reste applicable pour la durée de la page.
- [ ] Aucune incohérence d'hydratation n'apparaît en console sur les pages catalogue, carte, fiche application et Discover.
- [ ] Le thème et la densité du catalogue continuent d'être appliqués dès la première peinture, sans repeinte après hydratation.
- [ ] Le commentaire de `lib/useTheme.ts` décrit exactement ce que le code fait en matière de propagation entre onglets.
- [ ] `CLAUDE.md` énonce la règle qui décide du niveau d'un store de préférence, et les deux stores de la famille A y renvoient.
- [ ] Aucune dépendance n'a été ajoutée au projet.
- [ ] Le contrôle de types passe et l'application se construit sans avertissement nouveau.
