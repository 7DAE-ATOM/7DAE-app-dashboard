# Feature Spec: Sauvegarde et Chargement des Diagrammes Discover

## Summary
- Reproduire dans la barre d'outils de **Discover** le dispositif de sauvegarde déjà en service sur la page **Dependency Graph** de `7DAE-ltm-dashboard` (`/depgraph`) : un **bouton disquette** pour enregistrer d'un clic, et un **bouton « … »** ouvrant un menu à cinq actions — **Save**, **Save as new**, **Load**, **Export**, **Import**.
- Une sauvegarde est un **diagramme nommé** : les applications et interfaces présentes sur le canevas, leurs positions, leurs liens et les réglages de tracé propres à ce diagramme.
- Les sauvegardes vivent dans le **navigateur** (stockage local), sous un index de noms + une entrée par diagramme. Elles ne quittent le poste que par **Export** (fichier `.json`) et y reviennent par **Import**.
- Le bouton disquette porte l'état du diagramme courant : **pas de sauvegarde active**, **à jour**, ou **modifications non enregistrées**.
- Le modèle de données est **adapté à Discover** : on n'enregistre que ce que l'application ne sait pas retrouver par identifiant. Applications et data objects sont **résolus** dans des ressources déjà chargées par la page ; seules les **interfaces**, obtenues par des appels successifs au fil des dépliages, voient leur charge utile enregistrée.

## Motivation
- Construire un diagramme Discover est un **travail**, pas une consultation : on part d'une ou deux applications, puis on déplie les interfaces entrantes, les sortantes, les dépendances d'une interface, on masque le bruit, on redimensionne les rectangles, on déplace les boîtes jusqu'à une lecture claire. Aujourd'hui, un rafraîchissement d'onglet efface tout.
- Le lien `?ids=` n'est qu'une **graine** lue une fois : il rejoue la sélection initiale, pas le dépliage ni la mise en page. Rien ne permet de retrouver le diagramme tel qu'on l'avait laissé, ni de reprendre demain une analyse commencée aujourd'hui.
- Les exports existants (PNG, SVG, Mermaid) produisent une **image ou un texte figé** : on peut les montrer, pas les rouvrir pour continuer.
- La page `/depgraph` de l'application jumelle a déjà tranché ces questions (nommage, écrasement silencieux, état « sale », import validé, partage par fichier) et son ergonomie est connue des mêmes utilisateurs. Reproduire ce dispositif évite d'inventer un second vocabulaire pour le même besoin.

## Analyse de l'implémentation source (`7DAE-ltm-dashboard`)

Ce qui existe sur `/depgraph`, pour mémoire et comme référence de comportement :

- **`lib/interactionSaves.ts`** — la couche de stockage : un **index** de noms sous une clé, et **une entrée par sauvegarde** sous une clé préfixée. Tous les accès au stockage passent par des helpers tolérants qui renvoient `null`/`false` au lieu de lever. Le module porte aussi le **format versionné** (aujourd'hui `version: 3`, avec relecture transparente des formats 1 et 2), le **téléchargement** en `.json` (nom de fichier assaini) et un **validateur d'import** (`parseImportedSave`) qui contrôle réellement la structure d'un fichier étranger et rejette avec un message parlant.
- **`components/interaction/SaveLoadControls.tsx`** — toute l'interface : le bouton disquette, le bouton « … » avec son menu (fermé par `Escape` et par clic extérieur), et trois fenêtres modales — *Save as new* (saisie du nom), *Load* (liste des sauvegardes, chaque ligne portant un export et une suppression), *Import* (nom proposé d'après le fichier, conflit de nom signalé). Un bandeau d'erreur flottant affiche les échecs.
- **`components/InteractionClient.tsx`** — l'orchestrateur : il détient `activeSaveName`, `dirty`, la liste des sauvegardes et le « chargement en attente ». Il lit le diagramme **à la demande** via une poignée impérative (`getSnapshot()`), au moment du clic sur Save — jamais en continu.
- **`components/interaction/DependencyGraph.tsx`** — le canevas : il expose `getSnapshot()`, applique une sauvegarde chargée, et signale « modifié » via `onDirty()`. Un drapeau interne distingue une **remise à zéro programmée** (disposition initiale, chargement) d'une **édition utilisateur** (déplacement, dépliage, masquage), pour ne pas marquer sale ce que l'application vient elle-même d'écrire.

### Ce qui se transpose tel quel
La répartition des rôles (stockage / contrôles / orchestrateur / canevas), la poignée impérative pour ne lire le canevas qu'au clic, le drapeau « modification programmée vs utilisateur », l'écrasement silencieux sur un nom existant, le nom vide refusé, la validation d'import, le bandeau d'erreur. Discover possède déjà l'équivalent des deux points d'ancrage : `DiscoverGraphHandle.snapshot()` et `DiscoverClient` comme orchestrateur.

### Ce qui doit être adapté
1. **Un diagramme Discover n'est pas reconstructible depuis ses racines.** Sur `/depgraph`, un nœud est un banc du catalogue déjà chargé : la sauvegarde ne garde que des `externalId` et re-résout tout. Dans Discover, les **interfaces** (nom, protocole, identifiant externe, data objects) et les **applications non racines** arrivent par des requêtes déclenchées au menu contextuel, une par dépliage. Rejouer un diagramme depuis ses seules racines supposerait de rejouer la séquence exacte des dépliages — information que le canevas ne conserve pas. La sauvegarde doit donc **porter la charge utile des nœuds**, pas seulement leurs identifiants.
2. **Les cercles d'interface sont des enfants xyflow de leur fournisseur** : leur position est **relative** au rectangle parent, et le lien interface → fournisseur est un rattachement à part entière. La sauvegarde doit conserver ce rattachement et la nature relative des coordonnées, sans quoi les cercles se retrouveraient en coordonnées absolues autour de l'origine.
3. **La largeur des rectangles est réglable par l'utilisateur**, nœud par nœud. C'est de la mise en page, donc du contenu de diagramme.
4. **Le modèle de lien diffère** : `/depgraph` relie deux bancs par un lien typé ; Discover relie un **consommateur** à une **interface**, elle-même portée par un fournisseur, avec son type d'interface et sa fréquence.
5. **La sélection ne vit pas dans l'URL.** `/depgraph` tient sa sélection dans `?ids=` et un *Load* réécrit l'URL. Dans Discover, `?ids=`/`?seed=` est une graine **consommée une fois** ; un *Load* doit donc remplacer la sélection **en mémoire**, sans toucher à l'URL — sous peine de transformer un lien partagé en état mutable et de rejouer la graine au rechargement.
6. **Le mot « Export » est déjà pris.** Discover possède un menu d'export PNG / SVG / Mermaid. L'*Export* du menu « … » désigne autre chose : le fichier de sauvegarde rouvrable. Les deux doivent rester distincts et lisibles comme tels.
7. **Les sources de relecture ne sont pas uniformes, et il faut les distinguer une par une.** `/depgraph` a un seul cas : tout nœud est un banc du catalogue déjà chargé, donc tout se ramène à un identifiant. Discover en a trois. Les **applications** se re-résolvent dans le catalogue, comme les bancs. Les **data objects** se re-résolvent aussi : la page Discover charge déjà la hiérarchie complète des Data Objects (`id`, `name`, `description`) pour son panneau de mise en évidence, et c'est exactement ce qu'affiche la carte d'interface — le canevas lui-même ne publie d'ailleurs que des identifiants. Seules les **interfaces** n'ont pas de chemin de relecture en lot : leur nom et leur protocole arrivent au fil des dépliages, et les relire par identifiant coûterait une requête par interface. Elles seules justifient d'enregistrer leur charge utile.

## Décisions (arbitrées)
- **Même dispositif visuel qu'à `/depgraph`** : disquette + « … », mêmes intitulés anglais (`Save`, `Save as new`, `Load`, `Export`, `Import`), mêmes modales, même bandeau d'erreur. On copie une ergonomie éprouvée, on ne la réinvente pas.
- **Emplacement** : dans le groupe d'actions à droite de la barre Discover, **à la fin**, après le panneau de réglages d'affichage (engrenage). La barre garde ainsi son ordre actuel — recherche, sélection, mode de vue, icônes d'information, export graphique, réglages — et la nouvelle famille « fichier » s'ajoute sans bousculer les repères existants.
- **On n'enregistre une donnée que si l'application n'a pas d'autre moyen bon marché de la retrouver.** Règle appliquée élément par élément :
  - **Applications** — identifiant seul, re-résolu dans le catalogue chargé (nom à jour), avec un libellé de repli enregistré pour le cas où l'application a disparu ;
  - **Data objects des interfaces** — **identifiants seuls**, résolus dans la hiérarchie des Data Objects que la page Discover charge déjà pour son panneau de mise en évidence : nom et description viennent de là, à jour, sans appel supplémentaire ;
  - **Interfaces** — seul point encore ouvert : charge utile enregistrée (nom, protocole, identifiant externe), ou identifiants seuls avec relecture groupée à l'ouverture. Voir la question correspondante ; le reste de la spec décrit provisoirement la première branche, et la seconde n'en change que le contenu du fichier et le caractère asynchrone du *Load*.
- **Ce qui est sauvegardé, c'est le diagramme, pas les préférences** : le mode Simple/Complex, l'affichage des icônes d'information, le contenu des cartes et la courbure globale des liens sont des réglages utilisateur persistés ailleurs, communs à tous les diagrammes. Ils ne rentrent pas dans une sauvegarde et ne sont pas modifiés par un chargement.
- **Format versionné dès la version 1**, avec un numéro explicite et un refus net d'un format inconnu — la leçon des trois versions successives de `/depgraph`.
- **Écrasement silencieux** sur un nom existant lors d'un *Save as new*, comme à `/depgraph`. En revanche, un **import** sous un nom déjà pris est refusé, l'utilisateur n'ayant pas choisi ce nom lui-même.
- **Le stockage des sauvegardes n'est pas une préférence** : il ne passe pas par `lib/createPersistedStore.ts` (clé fixe, valeur unique, hydratation), mais par un module dédié à clés dynamiques, comme son homologue `interactionSaves.ts`.
- **Pas de synchronisation serveur, pas de partage en ligne** : le fichier exporté est le seul véhicule inter-postes.

## Requirements

### Functional Requirements

#### Le bouton disquette
- Bouton carré, aligné sur les autres commandes de la barre (même hauteur, même bordure, même fond).
- Trois états lisibles sans interaction :
  - **aucune sauvegarde active** : atténué et inactif, avec une infobulle disant que rien n'est encore enregistré ;
  - **sauvegarde active et à jour** : traitement « succès » ;
  - **sauvegarde active avec modifications non enregistrées** : traitement « alerte ».
- Un clic enregistre le diagramme courant **sous le nom actif**, sans fenêtre ni confirmation.
- Le nom de la sauvegarde active apparaît en infobulle.
- Le bouton est désactivé tant que le canevas est vide.

#### Le bouton « … » et son menu
- Bouton discret ouvrant un menu ancré sous lui.
- Le menu se ferme par `Escape`, par clic hors de lui, et après l'exécution d'une action.
- Cinq entrées, dans cet ordre :
  - **Save** — enregistre sous le nom actif ; désactivée s'il n'y en a pas ou si le canevas est vide.
  - **Save as new** — ouvre la saisie d'un nom ; désactivée si le canevas est vide.
  - **Load** — ouvre la liste des sauvegardes ; toujours disponible.
  - **Export** — télécharge le diagramme courant en fichier ; désactivée s'il n'y a pas de sauvegarde active ou si le canevas est vide.
  - **Import** — ouvre le sélecteur de fichier ; toujours disponible.
- Une entrée désactivée reste visible, atténuée, non cliquable.

#### Save as new
- Fenêtre modale avec un champ de saisie, focus automatique, validation par `Entrée`, annulation par `Escape` ou par clic sur le fond.
- Un nom vide ou composé d'espaces est refusé ; le nom est détouré de ses espaces de bord.
- Un nom déjà utilisé **écrase** la sauvegarde existante sans avertissement.
- Après l'enregistrement, la sauvegarde devient **active** et le diagramme est **à jour**.

#### Load
- Fenêtre modale listant les sauvegardes existantes, avec un message dédié quand il n'y en a aucune.
- Chaque ligne : le nom (cliquable pour charger), une action **exporter** et une action **supprimer**.
- Charger **remplace intégralement** le contenu du canevas et la sélection d'applications : nœuds, liens, positions, largeurs, rattachements.
- Après chargement, la sauvegarde chargée devient **active** et le diagramme est **à jour**.
- Supprimer la sauvegarde active fait retomber l'état sur « aucune sauvegarde active ».
- La suppression est immédiate, sans confirmation — conforme à la page source.

#### Export / Import
- **Export** produit un fichier `.json` lisible, nommé d'après la sauvegarde, les caractères interdits par le système de fichiers étant remplacés.
- L'export depuis la liste *Load* exporte la sauvegarde **telle qu'elle est enregistrée** ; l'export depuis le menu exporte le **diagramme courant**, modifications comprises.
- **Import** ouvre un sélecteur limité aux fichiers JSON, puis une fenêtre proposant un nom déduit du nom de fichier, modifiable.
- Le contenu du fichier est **validé structurellement** avant tout enregistrement : JSON invalide, fichier étranger, champs manquants ou mal typés, version inconnue — chacun produit un message distinct et rien n'est écrit.
- Un nom déjà utilisé est **signalé et bloqué** : l'utilisateur doit en choisir un autre.
- Un import réussi ajoute la sauvegarde à la liste **sans** la charger ni la rendre active.
- Ré-importer deux fois le même fichier reste possible (le sélecteur est réinitialisé après chaque choix).

#### Contenu d'une sauvegarde
- **Identité** : numéro de version du format, date d'enregistrement.
- **Racines** : les identifiants techniques des applications sélectionnées, c'est-à-dire les ancres du graphe.
- **Nœuds d'application** : identifiant technique, position, largeur si elle a été modifiée, et de quoi réafficher le nœud si l'application a disparu du catalogue (nom, identifiant externe).
- **Nœuds d'interface** : identifiant, position relative, **identifiant du fournisseur** et emplacement autour de lui, nom, protocole, identifiant externe, et les **identifiants** des data objects échangés — pas leur contenu.
- **Liens** : consommateur, interface, type d'interface, fréquence.
- **Tracé** : les courbures définies lien par lien par l'utilisateur, celles qui s'écartent du réglage global.
- Ne sont **pas** enregistrés : le mode de vue, les réglages d'affichage, la sélection de mise en évidence, les cartes d'identité ouvertes, le niveau de zoom et le cadrage.

#### État « modifications non enregistrées »
- Toute action de l'utilisateur modifiant le diagramme le marque comme modifié : déplacement d'un nœud, redimensionnement d'un rectangle, dépliage d'interfaces ou de dépendances, masquage, ajout ou retrait d'une application, courbure d'un lien.
- Ne le marquent **pas** : un *Save*, un *Load*, la disposition initiale de la graine, ni un changement de préférence d'affichage.
- L'état repasse à « à jour » après un *Save*, un *Save as new* ou un *Load* réussis.
- Ajouter ou retirer une application depuis la barre de sélection **détache** la sauvegarde active, comme à `/depgraph` : le diagramme n'est plus celui qui a été enregistré.

#### Chargement d'un diagramme dont le catalogue a bougé
- Les applications encore présentes dans le catalogue sont affichées avec leurs informations **à jour**.
- Celles qui ont disparu sont affichées avec les informations **enregistrées**, sans faire échouer le chargement.
- Si **aucune** racine ne se résout, le chargement est refusé avec un message explicite plutôt que d'afficher un canevas vide.

#### Erreurs
- Un bandeau d'erreur flottant affiche le dernier échec : écriture impossible (stockage indisponible ou plein), sauvegarde illisible, fichier d'import refusé.
- Le message disparaît à l'opération réussie suivante.
- Aucun échec de stockage ne fait perdre le diagramme affiché : le canevas reste intact.

### Non-Functional Requirements
- **Aucune dépendance nouvelle, et aucun appel réseau supplémentaire** — ni pour enregistrer, ni pour charger. Les deux résolutions par identifiant s'appuient sur des ressources que la page charge déjà : le catalogue des applications et la hiérarchie des Data Objects.
- **Sobriété du fichier** : on n'y recopie aucune donnée que l'application sait retrouver par identifiant. Un diagramme dense reste ainsi petit, ce qui éloigne la saturation du stockage local, et une description de data object corrigée dans le référentiel se voit sans réenregistrer quoi que ce soit.
- **Le canevas n'est lu qu'à la demande**, au moment de l'enregistrement — jamais en continu pendant un déplacement de nœud.
- **Aucune régression de rendu** : l'ajout des commandes ne doit pas re-rendre le graphe, et un diagramme chargé doit s'afficher en une passe, sans recalcul de disposition automatique.
- **Robustesse du stockage** : toute lecture ou écriture est tolérante — stockage indisponible, quota dépassé, entrée corrompue, index désynchronisé des entrées.
- **Sécurité** : un fichier importé est une donnée hostile ; il est validé champ par champ et jamais exécuté ni inséré tel quel.
- **Accessibilité** : commandes atteignables au clavier, modales étiquetées, actions par ligne nommées explicitement, état du bouton disquette non porté par la seule couleur.
- **Thèmes** : rendu correct en clair comme en sombre, sur les jetons de couleur existants.

## Scope

### In Scope
- Le module de stockage des diagrammes Discover : index, entrées, format versionné, téléchargement, validation d'import.
- Le composant de contrôles (disquette + menu « … » + trois modales + bandeau d'erreur), inspiré de son homologue `/depgraph`.
- L'orchestration dans `DiscoverClient` : sauvegarde active, état modifié, liste des sauvegardes, chargement en attente.
- L'extension du canevas Discover : application d'un diagramme chargé, signalement des modifications, et complétion de l'instantané avec ce qui manque pour une restitution fidèle (positions, largeurs, rattachements, courbures).
- La restitution des courbures définies lien par lien.

### Out of Scope
- Toute forme de sauvegarde côté serveur, de partage en ligne ou de diagramme collaboratif.
- Un rendu du diagramme en dehors de Discover (miniature, aperçu dans la liste).
- La modification des exports existants PNG / SVG / Mermaid.
- Le renommage ou la duplication d'une sauvegarde depuis la liste.
- Une sauvegarde automatique ou une restauration au rechargement sans action de l'utilisateur.
- L'avertissement « modifications non enregistrées » à la fermeture de l'onglet.
- La sauvegarde des préférences d'affichage dans le diagramme.
- Le graphe étoile de la fiche application, la carte et le catalogue.
- Toute modification de `7DAE-ltm-dashboard`.

## Affected Areas
- **Créer** :
  - un module de stockage des diagrammes dans `lib/` — index, lecture, écriture, suppression, export fichier, validation d'import, format versionné ;
  - un composant de contrôles dans `components/discover/` — disquette, menu « … », modales *Save as new* / *Load* / *Import*, bandeau d'erreur.
- **Modifier** :
  - `components/DiscoverClient.tsx` — état de sauvegarde, actions, insertion des commandes dans la barre, application d'un chargement à la sélection ;
  - `components/discover/DiscoverGraph.tsx` — application d'un diagramme chargé, signalement des modifications, instantané complété (positions, largeurs, rattachement et emplacement des interfaces) ;
  - `lib/discoverEdgeCurvature.ts` — lecture et réinjection en bloc des courbures propres à un diagramme ;
  - `components/discover/InterfaceInfoCard.tsx` — résolution des data objects par identifiant dans la hiérarchie (`lib/useDataObjectTree.ts`, déjà chargée par le panneau de mise en évidence) pour un nœud restauré, et états d'attente / d'indisponibilité correspondants.
- **Non touché** : `DiscoverExportMenu`, `DiscoverViewModeToggle`, `DiscoverInfoIconsToggle`, `DiscoverDisplaySettings`, `DiscoverHighlightPanel`, `lib/useDataObjectTree.ts` (consommé tel quel), `lib/discoverSeed.ts`, les adaptateurs et requêtes GraphQL, le catalogue et la carte.

## Edge Cases
- **Canevas vide** : disquette et *Save* / *Save as new* / *Export* désactivés ; *Load* et *Import* restent disponibles.
- **Sauvegarde puis retrait d'une application** : le diagramme se détache de la sauvegarde active, qui reste intacte dans la liste.
- **Chargement alors qu'un diagramme est déjà affiché** : remplacement intégral, y compris la barre de sélection ; rien du diagramme précédent ne subsiste.
- **Chargement d'un diagramme dont certaines applications ont disparu du catalogue** : elles s'affichent avec les informations enregistrées.
- **Chargement avant la fin du crawl des Data Objects** : le diagramme s'affiche immédiatement ; seules les cartes d'interface ouvertes attendent le détail de ce qui transite.
- **Crawl des Data Objects en échec** : le diagramme et les cartes s'affichent, sans le détail des data objects — le reste de Discover est inchangé.
- **Data object renommé, redécrit ou supprimé** depuis l'enregistrement : la carte montre l'état **actuel** du référentiel, un identifiant qui ne résout plus étant simplement omis.
- **Chargement d'un diagramme dont aucune racine ne se résout** : refus explicite, canevas inchangé.
- **Stockage plein** au moment d'un enregistrement : message d'erreur, diagramme préservé, sauvegarde existante non corrompue.
- **Navigation privée / stockage bloqué** : la liste est vide, les enregistrements échouent avec un message, l'exploration reste possible.
- **Entrée corrompue** dans le stockage : la sauvegarde est déclarée illisible, les autres restent utilisables.
- **Index désynchronisé** (nom listé sans entrée) : la ligne est affichée mais son chargement échoue proprement.
- **Import d'un fichier exporté par `/depgraph`** : refusé — format étranger — avec un message compréhensible.
- **Import d'un JSON valide mais sans rapport** : refusé au contrôle de structure.
- **Import sous un nom déjà pris** : bloqué, avec la raison affichée.
- **Nom contenant des caractères interdits dans un nom de fichier** : la sauvegarde les accepte, le fichier exporté les remplace.
- **Deux onglets Discover ouverts** : les listes peuvent diverger jusqu'au rafraîchissement ; le dernier enregistrement sous un même nom gagne.
- **Rechargement de la page** : aucun diagramme n'est restauré automatiquement ; les sauvegardes sont là, à charger explicitement.
- **Arrivée par un lien `?ids=` puis chargement d'une sauvegarde** : la sauvegarde gagne, l'URL n'est pas réécrite et la graine n'est pas rejouée.
- **Chargement pendant que la graine est encore en cours de chargement** : un seul contenu s'impose au bout du compte, sans mélange des deux.
- **Bascule Simple ↔ Complex après un chargement** : le diagramme reste le même, seul son tracé change ; le mode de vue n'a pas été enregistré.

## Open Questions
- **Emplacement exact dans la barre** : après l'engrenage de réglages (recommandé — la famille « fichier » s'ajoute en fin de groupe sans déplacer les repères actuels), ou avant le bouton d'export graphique pour regrouper toutes les sorties ? Recommandation : **après l'engrenage**. => suivre recommendation

- **Intitulé de l'entrée « Export » du menu**, le mot étant déjà porté par l'export PNG / SVG / Mermaid. Recommandation : garder **`Export`** à l'identique de `/depgraph` — les deux commandes vivent dans des menus différents, et l'infobulle du menu « … » lève l'ambiguïté. À défaut, `Export save file`.=> suivre recommendation

- **Courbures définies lien par lien** : aujourd'hui volontairement non persistées (état de session). Faut-il les inclure dans une sauvegarde ? Recommandation : **oui**. Ne pas les persister *en continu* est un choix assumé ; un enregistrement nommé est un acte explicite, et un diagramme rouvert sans ses courbures serait rouvert faux. => suivre recommendation

- **Carte d'interface quand la hiérarchie des Data Objects n'est pas encore là** (crawl en cours, ou en échec) : la carte doit-elle afficher les noms manquants, un état d'attente, ou rien ? Recommandation : **un état d'attente le temps du crawl**, puis, en cas d'échec, l'interface annoncée sans le détail de ce qui y transite — le même traitement que celui déjà réservé au panneau de mise en évidence, qui perd sa section plutôt que la page. => suivre recommendation

- **Data object disparu du référentiel** entre l'enregistrement et la relecture : son identifiant ne résout plus. Recommandation : **l'ignorer silencieusement**, comme une application disparue du catalogue ; le reste de la carte s'affiche. => suivre recommendation

- **Charge utile des interfaces : l'enregistrer, ou la recharger à l'ouverture ?** C'est la seule entorse restante au principe « identifiants seuls », et elle tient moins qu'il n'y paraît : les interfaces se relisent **en lot à partir des identifiants d'applications**, par l'appel groupé que le chemin de la graine emprunte déjà, et toute interface affichée a son fournisseur sur le canevas — donc rien n'échappe au rechargement. Ce n'est donc pas un coût par interface, mais quelques requêtes groupées.
  - **Enregistrer** : chargement instantané et sans réseau, mais nom et protocole figés à la date de l'enregistrement, et un fichier plus lourd.
  - **Recharger** : sauvegarde uniformément composée d'identifiants et de mise en page, données toujours à jour, fichier minimal — au prix d'un chargement asynchrone, donc faillible.
  - Recommandation : **recharger**, pour trois raisons. La page Discover est de toute façon inutilisable sans le backend (le catalogue d'applications y échoue en premier), donc la lecture hors ligne n'est pas un acquis que l'on perdrait. Une seule règle vaut mieux que deux : le fichier ne décrit alors **que** ce que l'utilisateur a construit — quels nœuds, où, reliés comment — et jamais le référentiel. Et un diagramme rouvert six mois plus tard montre l'état réel du parc, pas sa photo.
  - Contrepartie à assumer si cette voie est retenue : *Load* devient une opération qui peut échouer ou traîner, et doit donc l'annoncer (attente, puis message d'erreur laissant le canevas courant intact) au lieu d'être instantanée comme à `/depgraph`.

- **Nombre de sauvegardes** : faut-il un plafond ? Recommandation : **non**, comme à `/depgraph` ; le quota du navigateur fait office de limite et l'échec est déjà signalé. => suivre recommendation

- **Suppression sans confirmation** : conforme à la page source, mais un diagramme Discover représente plus de travail qu'une sélection de bancs. Recommandation : **conserver le comportement source** pour ne pas diverger, la suppression restant réservée à la liste *Load*. => suivre recommendation

- **Mode de vue Simple/Complex** : vraiment hors sauvegarde ? Recommandation : **oui**, c'est une préférence de lecture globale, déjà persistée pour elle-même ; l'enregistrer dans le diagramme créerait deux sources concurrentes pour un même réglage. => suivre recommendation

## Acceptance Criteria
- [ ] La barre de Discover porte un bouton disquette et un bouton « … », alignés visuellement sur les commandes existantes.
- [ ] Le menu « … » propose **Save**, **Save as new**, **Load**, **Export**, **Import**, dans cet ordre, et se ferme par `Escape` comme par clic extérieur.
- [ ] Les entrées inapplicables sont désactivées et visiblement telles, sans disparaître.
- [ ] *Save as new* refuse un nom vide, écrase silencieusement un nom existant, et rend la sauvegarde active.
- [ ] Le bouton disquette distingue « aucune sauvegarde », « à jour » et « modifications non enregistrées », et enregistre d'un clic sans fenêtre.
- [ ] Déplacer un nœud, redimensionner un rectangle, déplier des interfaces, masquer un nœud ou courber un lien marque le diagramme comme modifié ; un enregistrement ou un chargement le remet à jour.
- [ ] Un diagramme rechargé restitue **à l'identique** : applications, interfaces, liens, positions, largeurs, rattachement des cercles à leur fournisseur et courbures propres aux liens.
- [ ] Charger un diagramme remplace intégralement le canevas **et** la barre de sélection, sans réécrire l'URL ni rejouer la graine.
- [ ] Une application disparue du catalogue s'affiche avec les informations enregistrées ; un diagramme dont aucune racine ne se résout est refusé avec un message.
- [ ] Le fichier de sauvegarde ne contient **aucun nom ni description de data object**, seulement leurs identifiants.
- [ ] La carte d'une interface rechargée affiche les data objects avec leur nom et leur description **à jour**, issus du référentiel et non du fichier ; un data object renommé depuis l'enregistrement apparaît sous son nouveau nom.
- [ ] Un identifiant de data object qui ne résout plus est omis sans casser la carte ; un référentiel indisponible coûte le détail de la carte, pas le diagramme.
- [ ] *Export* produit un fichier `.json` au nom assaini, rouvrable par *Import*.
- [ ] *Import* valide le fichier, propose un nom modifiable, bloque un nom déjà pris, et ajoute la sauvegarde sans la charger.
- [ ] Un JSON invalide, un fichier étranger, une version inconnue et un fichier `/depgraph` produisent chacun un message distinct, sans rien écrire.
- [ ] La liste *Load* permet d'exporter et de supprimer chaque sauvegarde ; supprimer la sauvegarde active remet l'état à « aucune sauvegarde ».
- [ ] Un échec d'écriture (stockage plein ou indisponible) affiche un message et laisse le diagramme affiché intact.
- [ ] Le mode de vue, les icônes d'information, les réglages d'affichage et la mise en évidence ne sont ni enregistrés ni modifiés par un chargement.
- [ ] Aucun appel réseau n'est émis lors d'un enregistrement ou d'un chargement.
- [ ] Tout est utilisable au clavier et rendu correctement en thème clair comme sombre.
- [ ] Aucune régression sur la recherche, la barre de sélection, le menu contextuel, les exports PNG / SVG / Mermaid, le panneau de mise en évidence et le lien `?ids=`.
