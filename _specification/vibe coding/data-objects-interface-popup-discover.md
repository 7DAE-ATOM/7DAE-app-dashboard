# Feature Spec: Data Objects des Interfaces dans Discover

## Summary
- Afficher, dans le graphe Discover en **mode Complex** (celui où les interfaces sont représentées par des ronds), les **Data Objects échangés par chaque interface**.
- Une **icône d'information au centre du rond** de l'interface ouvre au clic une **carte flottante**, calquée sur celle déjà disponible pour les applications, listant pour chaque Data Object son **nom** et sa **description**.
- La relation `relInterfaceToDataObject` est **déjà interrogée** par les trois requêtes GraphQL du fichier `lib/leanix-interface-query.ts`, déjà typée (`DataObjectEdge`) et déjà fusionnée entre les deux sens de navigation. Il manque deux choses : le champ **`description`** dans la sélection, et le **transport** de ces données jusqu'au nœud d'interface, qui ne connaît aujourd'hui que son nom et son protocole.
- Périmètre : le mode Complex uniquement. En mode Simple les interfaces ne sont pas rendues, la fonctionnalité n'y a pas d'objet.

## Motivation
- Une interface, dans Discover, n'est aujourd'hui qu'un petit rond anonyme : son nom apparaît en infobulle, rien d'autre. Or ce qui intéresse l'architecte, c'est **ce qui transite** par cette interface.
- L'information existe déjà côté LeanIX et **arrive déjà dans le navigateur** — la relation est interrogée, reçue, typée, puis jetée faute de destination. Le coût d'exposition est donc faible au regard de la valeur.
- La carte d'identité des applications a établi le modèle d'interaction (icône ⓘ, carte flottante déplaçable, sections redimensionnables). Reprendre ce vocabulaire évite d'inventer un second geste pour une même intention : « montre-moi le détail de cet élément ».
- La description d'un Data Object est précisément ce qui manque pour lever les ambiguïtés de nommage entre deux flux voisins.

## Décisions (arbitrées)
- **Le champ `description` est ajouté à la seule sélection `relInterfaceToDataObject`**, aux trois endroits où elle apparaît dans `lib/leanix-interface-query.ts`. Les relations `relApplicationToDataObject` et `relApplicationToBusinessCapability`, qui partagent pourtant le même type d'arête, ne sont pas modifiées : alourdir leur charge utile pour une donnée qu'elles n'affichent pas serait gratuit.
- **Le type d'arête partagé accueille une `description` optionnelle.** Comme il sert aussi aux Business Capabilities, la nullité doit être la règle, jamais une hypothèse.
- **La carte d'interface est un composant distinct** de celle des applications, mais reprend sa présentation : même en-tête, même comportement de déplacement, mêmes sections redimensionnables. Les deux contenus n'ont rien en commun — forcer un composant unique reviendrait à empiler les conditions.
- **L'état d'ouverture reste dans le graphe**, exposé par un contexte, comme pour les applications : le nœud n'a pas à porter dans ses données quelle carte est ouverte, ce qui obligerait à reconstruire les données de chaque nœud à chaque ouverture.
- **Une seule carte ouverte à la fois**, toutes natures confondues : ouvrir la carte d'une interface ferme celle d'une application, et réciproquement.

## Requirements

### Functional Requirements

#### Données
- La requête rapatrie, pour chaque Data Object lié à une interface : `id`, `name`, `description`, et `externalId` lorsqu'il existe.
- Les Data Objects sont rattachés à l'interface dans le modèle du graphe, au même titre que son nom et son protocole, et survivent à la **fusion des deux sens de navigation** : une interface découverte d'abord comme fournie puis comme consommée (ou l'inverse) ne doit pas perdre ses Data Objects en cours de route.
- Une interface sans Data Object est un cas normal, pas une erreur.
- Aucune requête supplémentaire : l'information voyage dans les appels existants.

#### Icône sur le rond d'interface
- Une icône d'information est visible **au centre du rond** représentant l'interface.
- Le rond mesure aujourd'hui 20 px de côté : c'est trop peu pour y loger une icône lisible **et** conserver l'aspect « point de connexion » du nœud. L'arbitrage figure dans les questions ouvertes.
- Un clic sur l'icône **ouvre ou ferme** la carte de cette interface.
- Le clic sur l'icône ne doit ni déplacer le nœud, ni déclencher le déplacement du canevas, ni ouvrir le menu contextuel.
- L'icône reste lisible aux différents niveaux de zoom du graphe.
- L'infobulle du nom de l'interface, déjà présente, est conservée.

#### Carte des Data Objects
- La carte s'ouvre **à côté du rond** de l'interface, sans recouvrir celui-ci.
- Elle affiche en en-tête l'identité de l'interface (nom, à défaut protocole).
- Elle liste les Data Objects échangés ; pour chacun : le **nom** en évidence et la **description** en dessous.
- Elle se ferme par un clic sur l'icône, par un clic ailleurs sur le graphe, et par la touche d'échappement — comme la carte des applications.
- Elle se déplace par son en-tête, et la zone de contenu est redimensionnable, comme la carte des applications.
- Une description absente ou vide ne laisse pas de trou : le Data Object reste listé avec son seul nom.
- Une interface sans aucun Data Object affiche un message explicite d'absence, et non une carte vide — l'utilisateur doit pouvoir distinguer « rien à échanger » de « pas encore chargé ».
- Les descriptions LeanIX peuvent être longues : la carte doit rester utilisable sans occuper tout l'écran.

#### Articulation avec l'existant
- Le comportement de la carte d'identité des applications est inchangé.
- Ouvrir une carte d'interface ferme toute autre carte ouverte.
- Déplacer le nœud d'interface ou son application fournisseur pendant que la carte est ouverte ne doit pas laisser la carte orpheline à l'écran.
- Retirer du graphe l'application qui porte l'interface ferme la carte si elle était ouverte.

### Non-Functional Requirements
- **Aucune dépendance nouvelle**, aucun appel réseau supplémentaire : le surcoût se limite au champ `description` dans une réponse déjà demandée.
- **Aucun impact sur la disposition** du graphe autre que celui, assumé, d'un éventuel agrandissement du rond d'interface — le pas de placement des interfaces autour de leur fournisseur en dépend directement et devra suivre.
- **Accessibilité** : l'icône est un contrôle atteignable au clavier, avec un libellé explicite ; la carte annonce son ouverture et se ferme à l'échappement.
- **Thèmes** : rendu correct en clair comme en sombre, en réutilisant les jetons de couleur existants.
- **Robustesse** : toute partie de la relation peut être absente (`null`) côté LeanIX ; aucun cas ne doit produire d'erreur ni de carte cassée.

## Scope

### In Scope
- Ajout de `description` à la sélection `relInterfaceToDataObject` dans les trois requêtes concernées.
- Extension du type d'arête partagé avec une `description` optionnelle, et du modèle de Data Object exposé au front.
- Transport des Data Objects jusqu'au nœud d'interface, y compris à travers la fusion des deux sens de navigation.
- Icône d'information sur le rond d'interface, et ajustement de sa taille si nécessaire.
- Nouvelle carte flottante listant nom et description des Data Objects.
- Gestion d'ouverture exclusive entre la carte d'interface et celle des applications.

### Out of Scope
- Le mode **Simple**, qui ne représente pas les interfaces.
- La liste des Data Objects de la **carte d'application**, qui existe déjà et reste en l'état (elle n'affiche pas les descriptions).
- La fiche application (`/application`) et son onglet Data.
- Rendre les Data Objects **cliquables**, filtrables, ou nœuds du graphe à part entière.
- Afficher d'autres attributs d'un Data Object que son nom et sa description.
- Les exports (PNG, SVG, Mermaid) et le seed Discover partagé.
- Toute modification des requêtes Application et Business Capability.

## Affected Areas
- **Modifier** :
  - `lib/leanix-interface-query.ts` — champ `description` aux trois occurrences de `relInterfaceToDataObject`.
  - `lib/atom-api.ts` — `description` optionnelle sur le type d'arête partagé.
  - `lib/types.ts` — `description` optionnelle sur le modèle de Data Object exposé.
  - `lib/discover-graph-adapter.ts` — remontée des Data Objects d'une interface vers le modèle du graphe.
  - `components/discover/DiscoverGraph.tsx` — conservation des Data Objects dans la fusion des deux sens, données du nœud d'interface, état d'ouverture de la carte et son exclusivité avec celle des applications.
  - `components/discover/InterfaceNode.tsx` — icône d'information et clic.
  - `lib/discover-graph-layout.ts` — uniquement si la taille du rond change : le pas de placement des interfaces en dérive.
- **Créer** : le composant de carte des Data Objects d'une interface, et son contexte si l'existant n'est pas étendu.
- **Non touché** : `lib/application-adapter.ts` et la fiche application, `components/discover/ApplicationInfoCard.tsx` (comportement inchangé), `lib/discoverMermaid.ts`, `DiscoverExportMenu.tsx`, le catalogue et la carte.

## Edge Cases
- **Interface sans Data Object** : message d'absence explicite, pas de carte vide.
- **Data Object sans description** : listé avec son seul nom, sans espace vide.
- **Description très longue** : la carte reste bornée et lisible, sans déborder de l'écran.
- **Description contenant du balisage** (les descriptions LeanIX peuvent en contenir) : affichée comme du texte, jamais interprétée.
- **Doublons** : un même Data Object rattaché deux fois à l'interface ne doit apparaître qu'une fois.
- **Interface découverte par les deux sens** (fournie puis consommée) : les Data Objects sont conservés à la fusion.
- **Plusieurs interfaces voisines** : les ronds sont serrés autour de leur fournisseur ; l'icône de l'une ne doit pas déclencher l'ouverture de la carte d'une autre.
- **Zoom fort ou faible** : l'icône reste cliquable et identifiable.
- **Nœud déplacé carte ouverte** : la carte suit ou se ferme, mais ne reste pas isolée au milieu du canevas.
- **Application retirée du graphe** : la carte d'une de ses interfaces se ferme.
- **Bascule Complex → Simple** carte ouverte : la carte se ferme, les interfaces disparaissant.

## Open Questions
- **Taille du rond d'interface** : il fait 20 px, ce qui ne permet pas d'y loger une icône lisible. Faut-il (a) agrandir le rond à environ 28 px et y centrer l'icône, (b) garder 20 px et rendre **tout le rond** cliquable avec l'icône en filigrane, ou (c) n'afficher l'icône qu'au survol ? Recommandation : **(a)**, en vérifiant l'effet sur l'anneau d'interfaces autour du fournisseur, dont le pas de placement dérive de cette taille. L'option (b) est le repli si l'agrandissement dégrade la lisibilité du graphe. => suivre recommendation

- **Contenu de l'en-tête de la carte** : nom de l'interface seul, ou nom + protocole + identifiant externe ? Recommandation : **nom, protocole et identifiant externe s'il existe** — c'est peu coûteux et cela évite de devoir survoler le rond en parallèle.  => suivre recommendation

- **Ordre des Data Objects** : ordre renvoyé par LeanIX, ou alphabétique ? Recommandation : **alphabétique**, plus stable d'une ouverture à l'autre.  => suivre recommendation

- **Descriptions dans la carte d'application** : profiter de cette évolution pour les afficher aussi dans la section Data Objects des applications ? Recommandation : **non**, itération séparée — cela suppose d'alourdir la requête Application, qui est appelée bien plus souvent. => suivre recommendation

- **Nombre de Data Objects élevé** : faut-il plafonner l'affichage avec un « +N autres » ? Recommandation : **non en V1**, la carte étant déjà redimensionnable et défilante. 

## Acceptance Criteria
- [ ] En mode Complex, chaque rond d'interface porte une icône d'information visible et cliquable.
- [ ] Le clic ouvre une carte flottante à côté du rond, sans le recouvrir, et sans déplacer le nœud ni le canevas.
- [ ] La carte liste les Data Objects de l'interface avec, pour chacun, son **nom** et sa **description**.
- [ ] Une interface sans Data Object affiche un message d'absence explicite.
- [ ] Un Data Object sans description reste listé avec son seul nom.
- [ ] La carte se ferme par l'icône, par un clic ailleurs, et par la touche d'échappement.
- [ ] Ouvrir la carte d'une interface ferme celle d'une application, et réciproquement.
- [ ] Les Data Objects survivent à la découverte de l'interface par les deux sens de navigation.
- [ ] Aucune requête réseau supplémentaire n'est émise par rapport à aujourd'hui.
- [ ] Les requêtes Application et Business Capability sont inchangées.
- [ ] La disposition du graphe reste correcte si le rond d'interface a été agrandi, notamment quand une application porte plusieurs interfaces.
- [ ] Rendu correct en mode clair et en mode sombre, icône atteignable au clavier.
- [ ] Aucune régression sur la carte d'identité des applications, sur le mode Simple, sur les exports et sur le seed Discover.
