# Feature Spec: Filtres Partagés Catalogue / Carte et Lien « Clear »

## Summary
- Le panneau de filtres est le même composant sur le Catalogue, sur `/map` et dans la sheet mobile. Après la mémorisation de l'état **replié/déplié** des chapitres, étendre le même principe aux **valeurs sélectionnées** : les filtres posés sur le Catalogue se retrouvent sur la Carte, et inversement.
- Les valeurs sont **conservées d'une visite à l'autre** (rechargement, retour ultérieur), au même titre et par le même médium que l'état de repli.
- Comme rien ne remet plus les filtres à zéro tout seul, ajouter un **lien « Clear » à droite du titre FILTERING**, seul geste explicite de remise à zéro des sélections.
- Le lien n'apparaît que lorsqu'au moins un filtre est actif, et vide **toutes** les valeurs du panneau en un clic — sans toucher à l'état replié/déplié des chapitres.

## Motivation
- Aujourd'hui les deux vues ont deux états séparés : le Catalogue lit le magasin partagé `lib/catalogueFilters.ts`, tandis que `/map` garde son propre état local (`components/MapClient.tsx`, initialisé sur `DEFAULT_FILTERS`). Filtrer sur « Mission Critical » dans le catalogue puis basculer sur la carte affiche donc **toutes** les applications : l'utilisateur doit re-saisir son filtre, alors qu'il vient de le poser sur le même panneau, avec les mêmes axes.
- Le passage catalogue ↔ carte est précisément le moment où l'on veut garder son filtre : on cherche une population d'applications, puis on veut la voir sur une carte. Repartir de zéro casse ce raisonnement en deux.
- Le magasin de filtres est par ailleurs **en mémoire vive** : un simple rechargement efface tout. Cela avait été arbitré ainsi pour l'aller-retour catalogue → fiche détail, mais la même question se repose maintenant que l'état d'affichage du panneau, lui, survit aux visites. Un panneau dont le repli est mémorisé mais dont les valeurs disparaissent est incohérent à l'usage.
- Conséquence directe de cette conservation : il faut un moyen **visible et immédiat** de tout effacer. Le clic sur le menu « Catalogue » joue aujourd'hui ce rôle, mais c'est un effet de bord invisible — rien dans le menu n'annonce qu'il efface les filtres, et il n'existe pas sur `/map`. Un lien « Clear » posé à droite de FILTERING, dans le panneau lui-même, rend le geste explicite, disponible partout où le panneau est rendu, et dispense d'un effet caché sur un lien de navigation.

## Décisions (arbitrées)
- **Un seul jeu de valeurs pour les trois panneaux.** Catalogue, sheet mobile et `/map` lisent et écrivent les mêmes filtres. `/map` cesse d'avoir son état local.
- **Les valeurs sont persistées localement**, par le même médium que l'état de repli des chapitres : elles survivent au rechargement, à la fermeture de l'onglet et à une visite ultérieure, par poste et par navigateur.
- **Les sept axes sont concernés** : recherche globale, Photo, Category, Status, Portfolio, Operator, Business Criticality, Business Capabilities. Le champ de recherche et le champ Operator retrouvent leur texte à la restauration.
- **L'axe Business Capabilities est conservé même sur `/map`**, où il n'est pas rendu : sa valeur reste en réserve et reprend effet au retour sur le Catalogue. Le panneau de la carte ne peut ni le voir ni l'effacer autrement que par « Clear ».
- **La pagination n'est pas concernée.** Elle garde son comportement actuel (mémorisée pour l'aller-retour vers la fiche détail, remise à la première page à chaque changement de filtre), et n'est pas persistée d'une visite à l'autre.
- **Lien « Clear » : position et forme.** Sur la ligne du titre **FILTERING**, aligné à droite, au même niveau que lui. Présenté comme un lien discret (texte, pas un bouton plein), lisible dans les deux thèmes, sans icône nouvelle.
- **Affichage conditionnel** : le lien n'est visible que lorsqu'au moins une valeur est active. Panneau vierge, il disparaît — pas de commande sans effet.
- **Portée du « Clear » : toutes les valeurs, et rien d'autre.** Un clic vide les sept axes d'un coup, y compris l'axe Business Capabilities non rendu sur `/map`, et ramène la pagination à la première page. Il **ne touche pas** à l'état replié/déplié des chapitres : ranger le panneau et vider ses filtres restent deux gestes distincts.
- **Pas de confirmation, pas d'annulation.** Le geste est immédiat ; le coût d'une erreur est de re-saisir un filtre, pas de perdre des données.
- **Pas de « clear » par axe.** Un seul lien global. Décocher une pill reste le geste pour défaire un choix isolé ; le compteur porté par chaque en-tête de chapitre indique déjà où sont les valeurs actives.
- **Le menu « Catalogue » cesse d'effacer les filtres.** Il redevient un simple lien de navigation. L'effacement passe désormais exclusivement par « Clear », ce qui supprime un effet de bord que rien n'annonçait dans l'interface. Ce point **remplace** la décision correspondante de la spec « Persistance des Filtres du Catalogue à la Navigation Détail ».
- **L'arbre Business Capabilities est replié par le « Clear ».** Vider les sélections remet aussi l'arbre dans son état initial — même comportement qu'aujourd'hui lors d'une réinitialisation.
- **Restauration invalide : ignorée silencieusement.** Une valeur persistée qui ne correspond plus aux données (portfolio disparu, capability supprimée, statut inconnu) est écartée sans message ni plantage, comme le fait déjà la restauration existante.
- **Stockage indisponible** (navigation privée, quota) : les filtres restent partagés entre Catalogue et Carte **pour la session en cours**, simplement sans survivre au rechargement. Aucune erreur visible.
- **Pas de synchronisation temps réel entre onglets.** Chaque onglet applique ses propres changements ; la dernière écriture gagne pour la visite suivante — même règle que l'état de repli.
- **L'export PDF et « Show in Discover » ne changent pas** : ils continuent de porter sur l'ensemble filtré courant, quel que soit l'endroit d'où le filtre vient.

## Requirements

### Functional Requirements
- Les filtres posés sur le Catalogue sont appliqués tels quels à l'arrivée sur `/map`, et réciproquement.
- La sheet mobile partage le même jeu de valeurs que le panneau desktop de la vue courante.
- Les valeurs sont restaurées au rechargement de la page et lors d'une visite ultérieure ; les champs texte (recherche, Operator) réaffichent leur contenu.
- Un lien **« Clear »** est affiché à droite du titre FILTERING dès qu'au moins un filtre est actif, et masqué sinon.
- Cliquer « Clear » vide les sept axes, replie l'arbre Business Capabilities, ramène la liste à la première page, et laisse les chapitres dans leur état replié/déplié courant.
- Après un « Clear », le Catalogue affiche à nouveau la totalité des applications et tous les compteurs de chapitre retombent à zéro.
- Le lien « Clear » est disponible partout où le panneau est rendu : Catalogue, sheet mobile, `/map`.
- Le clic sur le menu « Catalogue » navigue sans effacer les filtres.
- Le retour depuis une fiche détail continue de retrouver les filtres **et** la page où l'utilisateur était.

### Non-Functional Requirements
- Aucun appel réseau, aucune dépendance serveur, aucune nouvelle dépendance npm.
- Aucune régression sur le filtrage, la pagination, la carte, l'export PDF, « Show in Discover », la fiche détail.
- Aucun avertissement de rendu/hydratation lié à la restauration des valeurs.
- Dégradation propre si le stockage local est indisponible.
- Le lien « Clear » est accessible au clavier et lisible dans les deux thèmes.
- `npm run build` doit rester vert.

## Scope

### In Scope
- Unification de l'état des filtres entre le Catalogue, la sheet mobile et `/map`.
- Persistance locale des valeurs de filtre et leur restauration.
- Ajout du lien « Clear » à droite du titre FILTERING, avec affichage conditionnel.
- Retrait de l'effacement des filtres déclenché par le menu « Catalogue ».

### Out of Scope
- Toute modification de l'apparence du panneau au-delà de l'ajout du lien : cartes, pills, chevrons, compteurs, typographie — inchangés.
- Un « clear » par chapitre, ou une puce d'effacement sur chaque valeur active.
- La persistance de la **pagination** d'une visite à l'autre.
- Le partage d'un état filtré par URL copiable, ou une préférence rattachée au compte utilisateur.
- Les filtres de la vue Discover, qui ont leur propre panneau.
- Une confirmation ou une annulation du « Clear ».

## Affected Areas
- `lib/catalogueFilters.ts` — magasin des filtres : il devient la source unique pour les deux vues et gagne une persistance locale ; sa remise à zéro est désormais déclenchée par le panneau plutôt que par le menu.
- `components/MapClient.tsx` — abandonne son état local de filtres au profit du magasin partagé.
- `components/FilterBar.tsx` — ligne du titre FILTERING : ajout du lien « Clear » et de sa condition d'affichage ; les champs texte locaux doivent se réaligner sur une valeur restaurée ou vidée de l'extérieur.
- `components/Header.tsx` — le lien « Catalogue » redevient une navigation simple.
- `components/FilterSheet.tsx`, `components/CatalogueClient.tsx` — consommateurs du panneau, à vérifier plus qu'à modifier.
- `_specification/vibe coding/persistance-filtres-catalogue-navigation-detail.md` — la décision « le menu Catalogue efface les filtres » et le choix « état en mémoire, perdu au rechargement » sont remplacés par la présente spec ; à annoter.

## Edge Cases
- **Première visite, aucune valeur enregistrée** : panneau vierge, lien « Clear » absent, catalogue complet.
- **Filtre posé sur `/map` puis retour au Catalogue** : le filtre est appliqué, et la pagination repart de la première page.
- **Axe Business Capabilities sélectionné, puis passage sur `/map`** : la carte n'affiche pas cet axe mais le filtre reste appliqué aux applications affichées ; l'utilisateur peut s'en défaire par « Clear ».
- **Valeur persistée devenue invalide** (portfolio supprimé, capability disparue) : ignorée à la restauration, sans erreur.
- **« Clear » alors que des chapitres sont repliés** : les valeurs sont vidées, les compteurs disparaissent, les chapitres restent dans leur état.
- **« Clear » depuis la sheet mobile** : même effet que sur desktop, la sheet reste ouverte.
- **Champ de recherche en cours de saisie au moment d'un « Clear »** : le champ se vide effectivement à l'écran, sans réapparition du texte précédent.
- **Deux onglets ouverts** (Catalogue dans l'un, Carte dans l'autre) : chacun garde son état à l'écran ; la dernière écriture gagne pour la visite suivante.
- **Navigation privée** : le partage Catalogue ↔ Carte fonctionne, la persistance entre visites non.
- **Retour depuis une fiche détail** : filtres et page restaurés comme aujourd'hui, sans interférence du « Clear ».

## Open Questions
- **Durée de vie** : les valeurs doivent-elles vraiment survivre à la fermeture du navigateur (stockage durable), ou seulement au rechargement de l'onglet (stockage de session) ? Un filtre étroit oublié depuis la veille peut donner l'impression d'un catalogue vide au retour — le lien « Clear » et les compteurs de chapitre atténuent ce risque, sans l'éliminer. => seulement au rechargement de l'onglet

- **Libellé** : « Clear », « Clear all » ou « Reset » ? Le reste du panneau est en anglais, le terme doit s'y accorder. => "Clear All"

- **Confirmation visuelle** : faut-il un retour éphémère après un « Clear » (mise en évidence du nombre de résultats, par exemple), ou le simple retour du catalogue complet suffit-il ? => pas de retour 

- **Cas des filtres non représentés dans la vue courante** : faut-il signaler sur `/map` qu'un filtre Business Capabilities invisible est actif, plutôt que de le laisser silencieux ? => Business capabilities doit également apparaitre sur Map, erreur à corriger

## Acceptance Criteria
- [ ] Filtrer le Catalogue sur deux catégories, aller sur `/map` → la carte affiche la même population, le panneau montre les deux catégories cochées.
- [ ] Poser un filtre Status sur `/map`, revenir au Catalogue → le filtre y est appliqué, la liste repart de la première page.
- [ ] Recharger la page (F5) avec des filtres actifs → les filtres sont toujours appliqués et les champs texte réaffichent leur contenu.
- [ ] Panneau sans aucun filtre → le lien « Clear » n'est pas affiché.
- [ ] Dès qu'un filtre est actif → le lien « Clear » apparaît à droite du titre FILTERING.
- [ ] Cliquer « Clear » → tous les axes sont vidés, tous les compteurs de chapitre disparaissent, l'arbre des capabilities est replié, le catalogue réaffiche `N / N applications`, la pagination revient à la première page.
- [ ] Après un « Clear », l'état replié/déplié des chapitres est **inchangé**.
- [ ] « Clear » depuis la sheet mobile et depuis `/map` produit le même effet.
- [ ] Cliquer le menu « Catalogue » avec des filtres actifs → navigation vers le catalogue **sans** effacer les filtres.
- [ ] Ouvrir une fiche détail puis « Back to catalog » → filtres et page restaurés.
- [ ] Le lien « Clear » est atteignable au clavier et lisible en thème clair comme en thème sombre.
- [ ] Aucun avertissement de rendu/hydratation en console ; `npm run build` passe sans erreur.
