# Mise à jour du 2 novembre 2026

## Installer avec GitHub Desktop et Netlify

1. Dans GitHub Desktop, ouvrez le dépôt UNIPLAST31, puis **Repository → Show in Explorer**.
2. Ouvrez l’archive de mise à jour et copiez **son contenu** dans ce dossier principal. Acceptez de remplacer les fichiers correspondants. `netlify.toml` et `package.json` doivent rester au même niveau. Ne créez pas un second dossier UNIPLAST31 dans le premier.
3. Dans GitHub Desktop, écrivez un résumé, cliquez **Commit to main**, puis **Push origin**.
4. Dans Netlify, attendez **Published**, puis rechargez le magasin. Aucun nouveau service ni abonnement n’est nécessaire pour appliquer cette mise à jour. Les limites de votre offre Netlify continuent de s’appliquer.

La migration des familles se fait une seule fois, dans le stockage existant. Elle conserve les références, prix, photos produit, poids, clients, codes, commandes et demandes. Une sauvegarde interne des anciennes familles et de leur classement est créée avant la migration et reste réservée au responsable. Les familles masquées et les familles personnelles sont conservées ; elles peuvent donc apparaître en plus dans la gestion. Les anciennes URL de familles regroupées ouvrent leur nouvelle famille.

Les dossiers `dist` et `server/generated` fournis servent au démarrage local. Git les ignore normalement et Netlify reconstruit sa propre version à partir des sources. Sur ordinateur, fermez l’ancienne instance de UNIPLAST puis lancez RUN.BAT après la copie. Si Windows bloque le remplacement d’un fichier ouvert, fermez le programme avant de recommencer.

## Marquer un produit comme nouveau

**Produits → Ajouter un produit** ou **Modifier → Nouveau produit**.

Cochez cette option : la pastille jaune **NOUVEAU** apparaît sur la photo et le produit rejoint automatiquement **Nouveaux produits**. Il reste aussi dans sa famille principale. Une date de fin facultative retire automatiquement la pastille et le produit de cette sélection, sans supprimer sa fiche. L’heure utilise le fuseau du magasin, normalement Africa/Algiers. Sans date, décochez l’option lorsque la nouveauté est terminée.

Dans **Réglages → Informations visibles sur les produits → Badge NOUVEAU**, vous pouvez masquer la pastille dans tout le magasin. Le classement comme nouveauté reste conservé.

## Familles et publicités

Les noms demandés sont : **Nouveaux produits**, **Rangement & Boîtes**, **Cuisine**, **Chaises et Tables**, **Salle de bain & Lavage**, **Enfant**, **pique-nique**, **🌿 Jardin**.

Le classement initial regroupe les anciennes familles. Les articles portant « enfant » dans leur nom sont rattachés à Enfant ; les articles de linge et les seaux de lavage sont placés dans Salle de bain & Lavage. Le classement reste modifiable dans la fiche produit. Vérifiez notamment les accessoires polyvalents **VP**, **POLY 001** et les usages particuliers de vos références : leurs noms seuls ne suffisent pas à déterminer votre classement commercial définitif. Aucun prix ni nom produit n’est modifié par cette nouvelle migration.

Dans **Collections → Modifier** :

- Ajoutez l’image de famille et son texte de présentation.
- Préparez les diapositives : images, titres, bouton, produit à ouvrir, ordre, zoom et position.
- Choisissez **Image et texte côte à côte** ou **Affiche complète**. Pour une affiche comportant du texte, utilisez **Image entière** afin de ne pas le couper.
- Réglez la hauteur, les secondes entre les images et le défilement automatique. Le visiteur dispose des flèches, points, pause et glissement tactile. Les personnes ayant demandé moins d’animations gardent une lecture manuelle.
- Ajoutez les **visuels publicitaires de la famille**. Ils apparaissent dans une grille sous le diaporama, avec un produit à ouvrir si vous le souhaitez.
- Désactivez chaque visuel pour le préparer sans l’afficher. Les réglages généraux peuvent aussi masquer tous les diaporamas, présentations, publicités, raccourcis ou invitations sur mesure.

Une image de famille est une illustration de collection. Elle ne remplace pas automatiquement les photos des produits : les références sans photo restent identifiables avec le filtre Sans photo.

## Conditions de fabrication sur mesure

Ouvrez **Réglages → Fabrication sur mesure**. Chaque option possède une explication.

- **Ouvrir les demandes** affiche ou masque les liens et le formulaire. Les anciennes demandes restent consultables.
- Écrivez vos **conditions** et indiquez le **minimum en pièces**. La valeur initiale 0 n’impose aucun minimum. 1 000 pièces est un exemple que vous pouvez choisir ; ce n’est pas une condition commerciale ajoutée automatiquement.
- Choisissez un minimum **pour chaque article** ou **pour l’ensemble de la demande**.
- Limitez le nombre d’articles (1 à 10), rendez les photos obligatoires et demandez l’acceptation des conditions si nécessaire.

Le visiteur indique son nom et son téléphone, puis ajoute les articles souhaités avec leur **nom**, **quantité entière en pièces** et jusqu’à **2 photos par article**. Il peut joindre quatre documents de référence supplémentaires. Les conditions et minimum sont vérifiés par le service lors de l’envoi. Leur version est conservée avec la demande.

Dans **Réservations & projets → Détails**, vous retrouvez les articles, quantités, photos privées et conditions au moment de l’envoi. Une demande ne crée ni vente, ni facture, ni engagement de fabrication automatique. Les réservations existantes continuent de fonctionner séparément.

## Afficher ou masquer les caractéristiques

Dans **Réglages → Informations visibles sur les produits**, activez séparément poids, matière, dimensions, capacité, code-barres, colisage, description, badge de disponibilité, badge NOUVEAU et produits associés. **Masquer les champs vides** évite d’afficher « Non renseigné ».

Les valeurs restent dans les fiches de gestion. Le poids se saisit en **grammes**. Le masquage du code-barres concerne son affichage, pas la recherche ni le scanner. Le panier conserve toujours les informations nécessaires à la commande en cartons. Un produit indisponible reste signalé et ne peut pas être acheté.

Les réglages de prix privé, connexion par téléphone/code, promotions, tri A–Z et filtres existants sont conservés. L’archive contient uniquement le programme et le catalogue source, sans les comptes, commandes, photos privées ou mots de passe du magasin publié. Le mode local et le site Netlify gardent chacun leur stockage existant.
