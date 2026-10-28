# UNIPLAST — Guide de la nouvelle version

Pour le site en ligne, suivez [l’installation Netlify](NETLIFY-FR.md). Le catalogue, les accès et les commandes sont conservés sur le même projet Netlify. Les instructions RUN.BAT ci-dessous concernent le PC. Images et PDF : 4 Mo maximum sur Netlify ; les limites locales restent 5 Mo pour les images et 15 Mo pour le catalogue PDF.

## Démarrer

Extrayez toute l’archive. Gardez ensemble **RUN.BAT**, **server** et **dist** (ou index.html + assets dans l’archive prête à utiliser). Node.js **22.18 ou plus récent** est nécessaire ; le lanceur utilise aussi Node fourni avec Codex s’il est présent. Double-cliquez sur RUN.BAT et choisissez **1**.

En bas de la boutique : **Espace de gestion → Se connecter**. Au premier démarrage, choisissez votre mot de passe administrateur de **12 caractères minimum**. Aucun mot de passe n’est prédéfini. Votre mot de passe se change dans **Réglages → Mot de passe du responsable**.

## Téléphone et code client

Dans **Clients agréés**, saisissez le nom, le téléphone et un code de **6 chiffres**, ou utilisez le bouton de génération. Cliquez sur **Enregistrer l’accès**, puis copiez le message ou utilisez le partage / Viber. Choisissez vous-même le destinataire et envoyez le message.

Le client appuie sur **Client agréé** et saisit uniquement son téléphone et son code. Aucune inscription, adresse e-mail ou demande d’activation. Les numéros algériens 05/06/07 et leur format +213 sont reconnus comme le même téléphone. Le zéro initial d’un code est conservé.

**Modifier / changer le code** permet de changer le téléphone, le code ou de désactiver l’accès. Un code vide pendant une modification conserve le code existant. L’enregistrement invalide les sessions du client ; il se reconnecte avec les coordonnées à jour. Les anciens codes ne sont jamais affichés dans la liste. Après trop de tentatives, l’accès est temporairement limité.

## Diaporamas et images

Dans **Réglages → Diaporama de la page d’accueil**, ouvrez une diapositive pour changer son texte et importer une image JPG, PNG ou WebP (5 Mo maximum). Réglez le zoom, le recadrage, les positions, la hauteur et la durée. La hauteur s’adapte au contenu et au téléphone. Les flèches, points, pause et gestes restent disponibles.

Dans **Un diaporama pour chaque collection**, choisissez la famille, modifiez ses diapositives puis cliquez sur **Enregistrer le diaporama de cette collection**. Le même éditeur est disponible dans **Collections → Modifier**. Chaque famille dispose d’une présentation initiale avec son nom et son image représentative ; remplacez les images pour personnaliser son univers. Vous pouvez masquer chaque diapositive avec sa case de visibilité.

Attendez la fin de l’importation des images. **Enregistrer les réglages** sauvegarde le diaporama d’accueil, « Qui sommes-nous ? », les coordonnées, le catalogue PDF et les réglages généraux. Le diaporama d’une collection a son propre bouton d’enregistrement.

## Promotions

Dans **Produits → Modifier**, configurez la promotion avec un prix remisé inférieur au prix normal et une période de début/fin. Enregistrez. Pendant cette période : cadre rouge épais, pourcentage agrandi, prix remisé rouge et ancien prix barré. Si les prix sont réservés, le visiteur voit la promotion et entre son téléphone et son code pour voir le montant. Aucune promotion de test n’est installée dans votre catalogue.

## Entreprise et suggestions

**Réglages → Qui sommes-nous ?** : titre, texte et photo de la présentation, visible sur l’accueil et sur sa propre page.

**Vos suggestions**, en bas de la boutique, reçoit les idées des visiteurs sans inscription. Les messages ne sont pas publics. Consultez-les dans **Suggestions clients** et marquez-les comme nouveaux, lus ou archivés.

Téléphones, Facebook, WhatsApp et catalogue PDF : **Réglages → Contacts, liens et catalogue PDF**. Les coordonnées officielles restent à renseigner ; aucune coordonnée supposée n’est ajoutée. Le PDF est public : utilisez une version sans prix si vous réservez les tarifs.

## Conservation et sauvegarde

La version RUN.BAT conserve les produits, familles, réglages, codes protégés, commandes et fichiers dans **.uniplast-data**, à côté du lanceur. Les codes sont hachés avec un sel et ne sont pas conservés en clair. Les fichiers de cette base ne sont pas servis par le site. La session utilise un cookie HttpOnly : 30 jours pour les clients et 8 heures pour l’administration.

Pour sauvegarder : quittez RUN.BAT avec **0**, puis copiez **.uniplast-data en entier** dans votre sauvegarde privée. Pour restaurer, fermez le programme et replacez ce dossier à côté de RUN.BAT sur le PC de destination. Gardez également le programme et son dossier server. Ne diffusez jamais .uniplast-data dans une archive envoyée à vos clients.

Les archives neuves ne contiennent ni base de tests, ni codes clients, ni mot de passe administrateur. Le catalogue d’origine contient **350 références / 17 familles**. La disponibilité doit être confirmée avant la vente ; 34 prix manquants restent à compléter.

## Menu de lancement

- **1** : ouvrir la boutique locale.
- **2** : reconstruire après modification du code ; quitter puis relancer pour charger le nouveau serveur.
- **3** : préparer un PC, installer les versions verrouillées puis construire. Internet peut être nécessaire.
- **4** : ouvrir les fichiers de l’interface locale, sans publication.
- **5** : diagnostic.
- **0** : arrêter le serveur de cette fenêtre et quitter.

Les choix 2 et 3 nécessitent le projet complet avec ses sources. DEMARRER-UNIPLAST.bat permet un lancement direct. Les fichiers BAT ne contiennent pas à eux seuls les fichiers du serveur ou le catalogue : partagez l’archive entière.

## Téléphones et Internet

Le lanceur écoute uniquement sur l’ordinateur. **127.0.0.1 n’est pas une adresse à envoyer à un client.** Pour les téléphones, utilisez le projet Netlify avec la configuration [NETLIFY-FR.md](NETLIFY-FR.md). Les données y sont partagées et conservées sur ce même site ; elles sont indépendantes de la base RUN.BAT du PC.

Le déploiement Netlify inclut le serveur et le stockage. Le simple dossier dist ne suffit pas. L’ancien build:web sans Supabase reste une prévisualisation annoncée ; il n’est pas utilisé par build:netlify.

Aucun paiement en ligne ni envoi Viber/WhatsApp automatique n’est activé.
