# Feature Spec: Filtres Repliés par Défaut et État Mémorisé Localement

## Summary
- Inverser l'état initial du panneau de filtres du Catalogue : **tous les sous-chapitres de FILTERING sont repliés à la première visite** (Photo, Category, Status, Portfolio, Operator, Business Criticality, Business Capabilities). Le panneau s'ouvre sur une table des matières compacte plutôt que sur sept axes empilés.
- **Mémoriser localement** l'état déplié/replié de chaque sous-chapitre dès que l'utilisateur le change : un chapitre ouvert reste ouvert, un chapitre refermé reste fermé, y compris après un changement de page, un retour depuis une fiche détail, un rechargement du navigateur ou la fermeture puis la réouverture de l'onglet.
- La mémorisation porte **uniquement sur l'affichage** (quels chapitres sont ouverts), jamais sur les **valeurs** de filtre — celles-ci gardent exactement leur comportement actuel.
- Le champ de recherche global et la rangée ACTIONS restent toujours visibles : ils ne sont pas repliables et ne sont pas concernés.

## Motivation
- Le panneau compte aujourd'hui sept axes, tous **dépliés** à l'arrivée. Même une fois chaque axe encadré dans sa carte, l'empilement reste long : l'arbre Business Capabilities, le plus haut de tous, n'est atteignable qu'après un défilement important, et sur mobile la sheet bornée à `85vh` impose un scroll interne dès l'ouverture.
- Le repli existe désormais, mais il est **remis à plat à chaque visite** : l'utilisateur qui a pris la peine de fermer les axes qu'il n'utilise pas les retrouve rouverts au retour sur la page. L'effort de rangement est perdu à chaque aller-retour catalogue → détail → catalogue, ce qui décourage l'usage de la fonctionnalité.
- Partir **fermé** et **se souvenir** répond aux deux problèmes d'un coup : le panneau est immédiatement parcourable d'un coup d'œil, et chaque utilisateur se construit au fil de l'eau la configuration qui correspond à ses axes de travail — typiquement Category et Status ouverts, le reste fermé.
- Le compteur de valeurs actives déjà présent sur chaque en-tête rend ce choix sans danger : un chapitre replié qui filtre le catalogue se signale de lui-même. Fermer par défaut ne cache donc jamais un filtre appliqué.
- La persistance locale par `localStorage` est un idiom déjà établi dans le dépôt (préférence de thème, réglages d'affichage de Discover, cache photos) : même médium, même durée de vie, aucune dépendance serveur, compatible avec le déploiement AFTER.

## Décisions (arbitrées)
- **État initial : tout replié.** À la toute première visite — aucune préférence enregistrée — les sept sous-chapitres sont fermés. Seuls le titre FILTERING, le champ de recherche et les sept lignes d'en-tête sont visibles.
- **Le champ de recherche global reste toujours visible et non repliable**, hors carte, directement sous FILTERING. C'est le point d'entrée principal du filtrage et il ne doit jamais demander un clic préalable.
- **La rangée ACTIONS reste intacte** : toujours visible, jamais repliable, non concernée par la mémorisation.
- **Granularité de la mémorisation : par sous-chapitre.** L'état enregistré est, pour chacun des sept axes, ouvert ou fermé. Pas de notion de « tout ouvrir / tout fermer » enregistrée globalement.
- **Déclencheur d'enregistrement : chaque basculement.** Cliquer sur un en-tête écrit immédiatement la nouvelle préférence ; il n'y a ni bouton « enregistrer », ni délai, ni confirmation.
- **Médium : stockage local du navigateur**, durable au-delà de la session (survit à la fermeture de l'onglet et du navigateur), par poste et par navigateur. Aucun appel réseau, aucune synchronisation entre postes, rien côté serveur.
- **Préférence unique, partagée par les trois panneaux.** Le desktop (colonne du Catalogue), la sheet mobile et `/map` rendent le même panneau : ils partagent la même préférence. Ouvrir « Status » sur la carte le laisse ouvert au retour sur le catalogue. Les axes absents d'un contexte (Business Capabilities et ACTIONS sur `/map`) gardent simplement leur préférence en réserve, sans effet tant qu'ils ne sont pas rendus.
- **La réinitialisation des filtres ne touche plus au repli.** Le bouton « Catalogue » du menu remet les valeurs de filtre à zéro et réinitialise l'arbre des capabilities, mais **respecte désormais la préférence d'affichage enregistrée** : il ne redéploie plus tous les chapitres. Vider ses filtres et ranger son panneau sont deux gestes distincts ; ce point **remplace** la décision inverse prise dans la spec « Sections de Filtres Repliables au Catalogue ».
- **Aucune interaction avec les valeurs de filtre.** L'état de repli n'entre ni dans `FilterValue`, ni dans l'URL, ni dans l'export PDF, ni dans la persistance existante des filtres catalogue → détail. Replier ou déplier ne modifie jamais les résultats affichés.
- **Chapitre inconnu ou nouveau : fermé.** Un axe ajouté plus tard, absent de la préférence enregistrée, applique la règle par défaut — fermé.
- **Préférence illisible ou corrompue : retour silencieux au défaut.** Une valeur invalide est ignorée et remplacée par « tout fermé », sans message d'erreur ni plantage.
- **Stockage indisponible** (navigation privée, quota, stockage bloqué) : le repli continue de fonctionner **pour la session en cours**, simplement sans être mémorisé d'une visite à l'autre. Jamais d'erreur visible.
- **Pas de réglage utilisateur exposé.** Aucun bouton « réinitialiser l'affichage du panneau », aucune case à cocher dans un menu de préférences : le comportement s'apprend par l'usage.
- **Pas de saut visuel perceptible à l'arrivée.** L'état par défaut rendu avant lecture de la préférence est l'état fermé ; la lecture de la préférence doit ouvrir les chapitres concernés sans que la page paraisse « se déplier » sous les yeux de l'utilisateur.
- **L'état interne de l'arbre Business Capabilities n'est pas concerné.** Seul l'état ouvert/fermé du chapitre est mémorisé ; les nœuds dépliés de l'arbre gardent leur comportement actuel (état vivant, non persisté).

## Requirements

### Functional Requirements
- À la première visite du Catalogue, les sept sous-chapitres du bloc FILTERING sont **repliés**.
- Le champ de recherche global, le titre FILTERING et la rangée ACTIONS restent visibles dans cet état.
- Cliquer sur l'en-tête d'un sous-chapitre le déplie ; recliquer le replie — comportement actuel inchangé.
- Chaque basculement est **enregistré localement** et immédiatement.
- Au retour sur la page (navigation interne, retour depuis une fiche détail, rechargement, nouvelle visite ultérieure), chaque sous-chapitre retrouve **l'état dans lequel l'utilisateur l'a laissé**.
- La préférence est commune au panneau du Catalogue, à la sheet mobile et au panneau de `/map`.
- Le compteur de valeurs actives reste affiché sur l'en-tête d'un chapitre replié, comme aujourd'hui.
- La réinitialisation des filtres via le menu « Catalogue » vide les valeurs mais **conserve** l'état de repli enregistré.
- Les valeurs de filtre, le nombre de résultats, la pagination et l'export PDF sont strictement inchangés par le repli ou le dépli d'un chapitre.

### Non-Functional Requirements
- Aucun appel réseau, aucune dépendance serveur, aucune nouvelle dépendance npm.
- Aucune régression sur le filtrage, la pagination, la carte, l'export PDF, la persistance existante des filtres.
- Aucune erreur ni avertissement de rendu lié à la différence entre le rendu initial et l'état restauré.
- Dégradation propre si le stockage local est indisponible : la fonctionnalité reste utilisable, seule la mémorisation disparaît.
- Compatible avec les deux thèmes (clair/sombre) et avec les trois contextes de rendu du panneau, sans traitement spécifique.
- `npm run build` doit rester vert.

## Scope

### In Scope
- Bascule de l'état par défaut du panneau : de « tout déplié » à « tout replié ».
- Mémorisation locale et durable de l'état ouvert/fermé de chacun des sept sous-chapitres.
- Restauration de cet état à chaque rendu du panneau, dans ses trois contextes.
- Ajustement du comportement de la réinitialisation des filtres, qui cesse de forcer le dépli.

### Out of Scope
- Toute modification de l'apparence du panneau : cartes, rayons, pills, typographie, espacements, compteurs — inchangés.
- Toute modification des **valeurs** de filtre, de leur persistance catalogue → détail, ou de leur sérialisation dans l'export PDF.
- Un bouton « tout déplier / tout replier ».
- Une préférence synchronisée entre postes ou rattachée au compte utilisateur.
- La persistance de l'état déplié/replié des **nœuds** de l'arbre Business Capabilities.
- Un réglage exposé dans une page de préférences.

## Affected Areas
- `components/FilterBar.tsx` — l'état de repli, aujourd'hui local au composant et initialisé « tout ouvert », devient un état par défaut fermé, lu et écrit dans une préférence persistée ; l'effet qui redéploie tout à la réinitialisation des filtres est retiré.
- Un petit module de préférence sous `lib/` — sur le modèle des modules de réglages existants (`lib/discoverDisplaySettings.ts`, `lib/photoCacheSettings.ts`) : lecture tolérante, écriture tolérante, valeur par défaut côté rendu initial.
- Indirectement, sans modification de code attendue : `components/FilterSheet.tsx`, `components/MapClient.tsx`, `components/CatalogueClient.tsx`, qui consomment le panneau tel quel.
- `_specification/vibe coding/sections-filtres-repliables-catalogue.md` — deux décisions y sont explicitement remplacées par la présente spec (état par défaut, et redéploiement au reset) ; à annoter pour éviter toute lecture contradictoire.

## Edge Cases
- **Première visite, aucune préférence** : les sept chapitres sont fermés.
- **Préférence partielle** (enregistrée avant l'ajout d'un axe) : les axes connus sont restaurés, le nouvel axe est fermé.
- **Préférence corrompue ou d'un format inattendu** : ignorée silencieusement, retour à « tout fermé ».
- **Navigation privée / stockage bloqué / quota atteint** : le repli fonctionne pour la session, la mémorisation est sans effet, aucune erreur visible.
- **Deux onglets ouverts en parallèle** : chacun applique ses propres basculements ; la dernière écriture gagne pour la visite suivante. Aucune synchronisation en temps réel n'est attendue entre onglets.
- **Chapitre replié portant des filtres actifs** : son compteur reste visible — c'est la garantie que l'état fermé par défaut ne masque jamais un filtre appliqué.
- **Réinitialisation via le menu « Catalogue »** : les valeurs sont vidées, les compteurs retombent à zéro, mais les chapitres ouverts le restent.
- **Panneau de `/map`** : les axes absents (Business Capabilities) ne sont pas rendus ; leur préférence est conservée intacte et reprend effet au retour sur le catalogue.
- **Sheet mobile** : l'état restauré s'applique à chaque ouverture de la sheet, sans animation de dépliage à l'ouverture.
- **Utilisateur ayant tout replié puis rouvrant la page** : le panneau reste entièrement replié, sans clignotement d'ouverture.

## Open Questions
- **Portée de la préférence** : une préférence unique partagée par le catalogue, la sheet et `/map` (proposition retenue ci-dessus), ou une préférence distincte par contexte, `/map` n'ayant pas les mêmes axes ? => préférence unique

- **Réinitialisation « dure »** : faut-il malgré tout un geste permettant de revenir à l'état par défaut (tout replié) sans vider le stockage du navigateur à la main ? => non pour l'instant

- **Exception pour la recherche** : le champ de recherche global reste hors du dispositif ; faut-il de même garder un axe systématiquement ouvert (par exemple Category) pour qu'un nouvel utilisateur voie au moins un exemple de filtre rempli ? => non

## Acceptance Criteria
- [ ] Première visite du Catalogue, aucune préférence enregistrée → les sept sous-chapitres sont repliés ; le titre FILTERING, le champ de recherche et la rangée ACTIONS restent visibles.
- [ ] Déplier « Category » et « Status », naviguer vers une fiche détail puis revenir → « Category » et « Status » sont toujours dépliés, les autres repliés.
- [ ] Déplier un chapitre puis **recharger** la page (F5) → le chapitre est toujours déplié.
- [ ] Fermer l'onglet, rouvrir l'application → l'état de repli est celui laissé à la visite précédente.
- [ ] Déplier « Status » sur `/map`, revenir au catalogue → « Status » y est déplié.
- [ ] Sélectionner deux catégories, replier le chapitre, cliquer le menu « Catalogue » → les filtres sont vidés, les compteurs à zéro, **et l'état de repli enregistré est conservé** (les chapitres ne se rouvrent pas tous).
- [ ] Replier/déplier un chapitre ne modifie ni la grille de résultats, ni le compteur `N / M applications`, ni la pagination, ni l'export PDF.
- [ ] En navigation privée, replier/déplier fonctionne pour la session sans erreur console ; la mémorisation est simplement sans effet.
- [ ] Aucun avertissement de rendu/hydratation en console au chargement du catalogue.
- [ ] Le panneau se comporte à l'identique en thème clair et en thème sombre, en desktop, dans la sheet mobile et sur `/map`.
- [ ] `npm run build` passe sans erreur.
