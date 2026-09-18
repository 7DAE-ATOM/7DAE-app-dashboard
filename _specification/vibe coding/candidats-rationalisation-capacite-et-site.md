# Feature Spec: Candidats à la rationalisation — même capacité, sites différents

## Summary
- Un écran d'analyse qui répond à une question que l'outil ne sait pas poser aujourd'hui : **plusieurs applications couvrent-elles la même capacité métier sur des sites différents ?**
- Le motif recherché est précis : pour une capacité donnée, au moins deux applications dont les **ensembles de sites sont disjoints**. C'est la signature d'un héritage historique — chaque site a construit le sien — plutôt que d'un besoin réellement distinct.
- La lecture repose sur une **bande de sites** : une case par site, remplie là où l'application est utilisée. Deux bandes complémentaires se repèrent sans lire un mot.
- L'écran **mène avec le résultat** : une liste de candidats classée par indice de disjonction, pas une grande matrice à explorer.
- Il produit des **candidats à examiner, jamais un verdict** — le modèle de capacités est trop grossier pour conclure à la place de quelqu'un qui connaît les applications.

## Motivation
- La question « pourrait-on rationaliser ? » n'a aujourd'hui aucune réponse dans l'outil. Les deux informations nécessaires y sont pourtant : `businessCapabilities` depuis l'origine, et les sites depuis le lot des bulles sur la carte. Rien à demander au backend.
- **La carte ne peut pas y répondre.** Elle montre *où*, et cette question porte sur un *recouvrement fonctionnel* dont la géographie n'est qu'un attribut. Deux applications concurrentes sur la même capacité produiraient deux bulles au même endroit, sans que rien n'indique qu'elles font la même chose.
- Croiser à la main capacités et sites sur plusieurs centaines d'applications est hors de portée : c'est exactement le travail qu'un écran doit faire, et exactement le genre de constat qu'on n'obtient jamais parce que personne n'a le temps de le construire.
- L'enjeu est concret : une capacité couverte par trois outils locaux là où un outil groupe existe déjà est un coût de maintenance, de formation et de conformité multiplié par trois.

## Décisions (arbitrées)

### Le motif recherché, et ses deux formes
- Le signal est calculé **par capacité** : l'ensemble des applications qui la déclarent, et pour chacune l'ensemble de ses sites.
- **Deux histoires distinctes, à ne jamais confondre :**
  - **Fragmentation géographique** — les couvertures sont disjointes ou presque. Chaque site a son outil. La rationalisation consiste à en choisir un et à migrer les autres.
  - **Doublon sur place** — les couvertures se superposent. Deux applications servent la même capacité aux mêmes utilisateurs. Plus rare, plus embarrassant, et souvent le signe d'une acquisition ou d'une migration inachevée.
- Un **indice de disjonction** ordonne la liste : maximal quand aucun site n'est partagé, nul quand les couvertures sont identiques. Les deux extrêmes sont intéressants ; c'est le milieu qui est tiède.

### La bande de sites
- Une case par site, dans un ordre **fixe et identique partout**, remplie quand l'application y est utilisée. C'est le cœur visuel : la comparaison se fait par superposition de formes, pas par lecture de listes.
- Trois états de case, pas deux : **utilisée**, **non utilisée**, et **non renseignée**. Confondre les deux derniers fabriquerait de la fausse fragmentation — une application sans site déclaré paraîtrait ne concurrencer personne.
- Les applications déclarées sur **tous les sites** ont une bande pleine. Traitées à part (voir ci-dessous), elles ne sont pas dessinées comme les autres.

### Les applications « tous sites »
- Une application à couverture globale **ne paraîtra jamais fragmentée** et **masquera la fragmentation des autres**, puisqu'elle recouvre tout le monde. La laisser dans le calcul ordinaire viderait l'écran de son signal.
- Elle est donc signalée comme **couverture globale déjà en place** sur la capacité concernée. C'est d'ailleurs souvent l'argument de rationalisation le plus fort : *un outil groupe existe déjà, pourquoi trois outils locaux ?*
- Une capacité portant à la fois une application globale et des applications locales est un candidat **prioritaire**, pas un candidat écarté.

### Le niveau de capacité
- Le niveau décide de tout. Au sommet de l'arbre, tout paraît redondant et l'écran ne vaut rien ; près des feuilles, le signal est exploitable.
- Les applications se rattachent à des nœuds de **profondeurs variables** — le modèle ne garantit pas qu'elles pointent toutes des feuilles. L'analyse doit donc travailler à un niveau choisi et **y rattacher les liens plus profonds**, plutôt que d'ignorer ce qui ne tombe pas pile.
- Le niveau retenu par défaut est une décision ouverte (voir Open Questions), mais il doit être **affiché et modifiable** : un chiffre de redondance dont on ignore la granularité n'est pas interprétable.

### Mener avec la conclusion
- L'écran principal est une **liste de candidats classée**, pas une matrice. Chaque ligne porte la capacité, le nombre d'applications, le nombre de sites couverts, les bandes empilées, et la nature du motif — fragmentation ou doublon.
- Une grande matrice capacités × sites ferait *chercher* le signal à l'utilisateur ; avec plusieurs centaines d'applications et un arbre profond, elle serait illisible. Le détail n'apparaît qu'au clic.
- Le détail d'une capacité montre ses applications avec leurs bandes, leurs sites nommés, et un lien vers chaque fiche.

### Un outil de suspicion, pas de décision
- Le vocabulaire est celui du **candidat** et de la **piste**, jamais du doublon avéré ni de la recommandation. Deux applications sous la même capacité peuvent faire des choses réellement différentes : le modèle de capacités est une classification, pas une spécification fonctionnelle.
- C'est ce qui décidera de la crédibilité de l'écran auprès de ceux qui connaissent ces applications — un outil qui affirme trop est écarté au premier contre-exemple.

### Où ça vit
- **Pas sur `/map`.** C'est une vue d'analyse, pas de localisation. La carte garde son rôle : montrer la répartition.
- L'écran est autonome et lit les mêmes données que le reste de l'application, sans appel supplémentaire.
- Il **ne modifie rien** : ni les filtres partagés du catalogue, ni les données.

## Requirements

### Functional Requirements
- Identifier, pour chaque capacité au niveau choisi, les applications qui la couvrent et leurs sites.
- Classer les capacités portant au moins deux applications selon leur indice de disjonction, et distinguer fragmentation et doublon.
- Afficher une bande de sites par application, à trois états, dans un ordre de sites constant.
- Signaler les capacités déjà couvertes par une application « tous sites », et les traiter comme prioritaires plutôt que comme résolues.
- Permettre d'ouvrir le détail d'une capacité, avec accès à la fiche de chaque application.
- Afficher et permettre de changer le niveau de capacité de l'analyse.
- Rendre visible le nombre de capacités et d'applications écartées de l'analyse, et pourquoi.

### Non-Functional Requirements
- Aucun appel réseau nouveau : les capacités et les sites sont déjà chargés.
- Le calcul doit rester imperceptible sur le parc actuel et supporter un changement de niveau sans attente notable.
- Le vocabulaire employé ne doit jamais présenter un candidat comme un doublon établi.
- Rendu correct dans les deux thèmes, et sur écran étroit — où des bandes de neuf cases sont le point de tension.
- Les bandes doivent rester interprétables sans la couleur seule : une case remplie et une case vide se distinguent par autre chose qu'une teinte.
- Aucune dépendance tierce ; le contrôle d'absence d'appel externe reste au vert.

## Scope

### In Scope
- Le calcul du recouvrement capacité × application × site.
- La liste de candidats classée, et le détail d'une capacité.
- La bande de sites à trois états.
- Le choix du niveau de capacité.
- Le traitement explicite des applications « tous sites », sans site, et à site non reconnu.

### Out of Scope
- Toute recommandation de l'application à conserver, et toute notion de coût, de licence ou d'effort de migration.
- La modification des données : ni marquage, ni décision, ni plan de migration stocké.
- L'export de l'analyse — à traiter séparément une fois la lecture stabilisée.
- La comparaison fonctionnelle fine de deux applications : le modèle de capacités ne la permet pas.
- Un axe « site » dans le panneau de filtres du catalogue.
- La détection de redondance sur d'autres axes que la capacité métier (data objects, technologies).
- Toute évolution de la carte.

## Affected Areas
- **Créer** : l'écran d'analyse et ses composants — liste de candidats, bande de sites, détail d'une capacité.
- **À exploiter** : le rattachement des applications aux capacités déjà présent dans le modèle, et l'arbre hiérarchique reconstruit côté client, y compris ses utilitaires de sous-arbre qui permettent de rattacher un lien profond à un niveau choisi.
- **À exploiter** : la table des sites et le classement des applications introduits par le lot des bulles sur la carte — notamment la distinction entre « tous sites », « site inconnu » et « site non renseigné », qui est exactement ce dont les trois états de case ont besoin.
- **À exploiter** : la convention de lien vers la fiche détaillée, ouverte dans un nouvel onglet.
- **Vérifier** : la navigation principale, qui devra accueillir une entrée supplémentaire.
- **Non touché** : la carte, le catalogue, les filtres partagés, la couche API et la requête LeanIX.

## Edge Cases
- **Capacité portée par une seule application** : ce n'est pas un candidat, et elle n'encombre pas la liste.
- **Application sans capacité déclarée** : invisible pour cette analyse. À compter et à signaler, sinon l'écran laisse croire que le parc est entièrement couvert.
- **Application sans site, ou à site non reconnu** : sa bande ne doit pas ressembler à une absence d'usage. Troisième état obligatoire.
- **Capacité dont toutes les applications sont « tous sites »** : aucune fragmentation géographique possible ; c'est un doublon global, pas un cas à écarter.
- **Application rattachée à plusieurs capacités** : elle apparaît dans plusieurs candidats. Attendu, mais la lecture doit éviter de faire croire à un problème démultiplié.
- **Application présente sur un seul site** : bande à une case. Deux applications mono-site sur la même capacité sont le cas d'école — et le plus facile à manquer si l'indice privilégie les grandes couvertures.
- **Niveau de capacité trop haut** : la liste se remplit de faux positifs. Le changement de niveau doit rendre cet effet évident plutôt que le subir.
- **Capacité sans nom ou orpheline dans l'arbre** : ne doit pas faire disparaître ses applications silencieusement.
- **Écran étroit** : neuf cases par bande plus un nom d'application ne tiennent pas. Une dégradation est à prévoir, pas à découvrir.
- **Deux applications aux bandes identiques mais complémentaires sur un seul site** : cas limite entre les deux histoires. La classification doit être stable et explicable, pas fondée sur un seuil arbitraire invisible.

## Open Questions
- **Quel niveau de capacité par défaut** ? Le plus profond disponible donne le signal le plus fin mais fragmente l'analyse ; un niveau intermédiaire est plus lisible mais produit des faux positifs. Faut-il un défaut fixe, ou le niveau le plus profond auquel un nombre suffisant d'applications se rattachent réellement ?
- **Où placer l'écran** : une entrée de navigation à part entière, ou un onglet d'un écran d'analyse plus large appelé à recevoir d'autres croisements ?
- **Faut-il montrer les capacités saines** — couvertes par une seule application, ou par plusieurs applications parfaitement superposées sur tous les sites ? Elles rassurent et donnent une échelle, mais diluent la liste.
- **L'indice de disjonction doit-il tenir compte de la taille des couvertures** ? Deux applications mono-site sur deux sites différents sont parfaitement disjointes, comme deux applications couvrant chacune quatre sites. Le second cas pèse plus lourd ; faut-il que le classement le dise ?

## Acceptance Criteria
- [ ] Une capacité couverte par deux applications aux sites disjoints apparaît en tête de la liste des candidats.
- [ ] Une capacité couverte par deux applications aux mêmes sites est présentée comme un doublon sur place, distinctement de la fragmentation.
- [ ] Les bandes de sites emploient un ordre de sites identique partout et distinguent trois états : utilisé, non utilisé, non renseigné.
- [ ] Une application déclarée sur tous les sites est signalée comme couverture globale, et sa capacité reste dans la liste plutôt que d'en être écartée.
- [ ] Le niveau de capacité employé est affiché, modifiable, et son changement met la liste à jour sans rechargement.
- [ ] Le nombre d'applications écartées de l'analyse — sans capacité, sans site — est visible et exact.
- [ ] Le détail d'une capacité donne accès à la fiche de chaque application, dans un nouvel onglet.
- [ ] Aucun libellé de l'écran ne présente un candidat comme un doublon avéré ni ne recommande une application à supprimer.
- [ ] Les bandes restent lisibles en thème clair et sombre, et sans recours à la couleur seule.
- [ ] Aucune requête réseau nouvelle ; le contrôle d'absence de dépendance tierce reste au vert.
- [ ] Aucune régression sur le catalogue, la carte, les filtres partagés, Discover et les exports.
