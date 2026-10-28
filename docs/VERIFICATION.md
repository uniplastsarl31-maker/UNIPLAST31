# Vérification — 27 octobre 2026

## Version actuelle

Les commandes de construction locale et web, les contrôles TypeScript et les suites de tests métier, SQLite local et PostgreSQL/PGlite ont réussi. La suite SQL historique vérifie 001/002 ; la nouvelle suite exécute 001/002/003 avec la vraie extension pgcrypto et bcrypt.

## Contrôles automatiques

- CSV byte-identique (SHA-256 917bbcdc4a37c5a66a401d7b139c5d33845e010d7431856bc1665e746d7cb65c), 350 références, 17 familles, 34 prix absents. Pas de stock disponible, remise, vente ou client de test dans les données livrées.
- Base SQLite : mot de passe administrateur choisi à l’initialisation, hachage scrypt salé, téléphone normalisé, code de 6 chiffres dont zéro initial, aucun code en clair dans la liste ou le journal SQLite de test.
- Prix réellement retirés des réponses aux visiteurs ; interdiction des écritures anonymes, origines étrangères refusées ; fichiers de référence privés.
- Redémarrage du stockage : réglages, diapositives, zoom, images, suggestions et sessions conservés.
- Rotation/désactivation du code invalide les sessions ; un autre appareil avec le code courant retrouve les commandes du même client. Changement de mot de passe administrateur invalide ses anciennes sessions. Limitation des tentatives persistante après redémarrage.
- Commande : calcul en centimes, quantité/stock/prix/colisage/frais/devise vérifiés, rejouement idempotent, instantané historique, annulation et restauration de stock une seule fois.
- Demande sur mesure invitée sans adresse ni compte, idempotence, précommande fermée refusée, fichiers privés et suivi administrateur.
- PostgreSQL 003 : bcrypt, RLS, tables de codes et hachages inaccessibles, RPC administrateur réservé, tentatives échouées conservées, révocation et déconnexion, historique lié au code plutôt qu’au seul navigateur.
- Champs de présentation et suggestions SQL sauvegardés ; les visiteurs ne lisent ni ne modifient les suggestions.
- Audit du build local : aucun des 350 identifiants produits du fichier source ni module previewCatalog dans les scripts distribués. Le catalogue privé est dans server/generated, hors interface publique.
- Build web sans configuration : catalogue de prévisualisation sans les prix originaux ni métadonnées privées. Avec Supabase configuré, le catalogue est chargé du service.

## Contrôles navigateur sur base de vérification isolée

- Interface française, logo et photos conservés, diaporama d’accueil et de collection, boutons précédent/suivant/points/pause, mise en page mobile à 390 × 844.
- Entrée téléphone + code, confirmation d’accès, apparition des tarifs. Le compte de test est créé uniquement dans work, jamais dans les archives.
- Promotion de vérification : cadre rouge épais, −25 %, prix de 75 DA en rouge à 36 px sur mobile, ancien prix barré, nom et colisage visibles. Ces prix/remises servent uniquement à la vérification.
- Aucun débordement horizontal de page sur le mobile inspecté. Défilement volontaire des rails et tableaux maintenu.
- Upload réel d’une image depuis les Réglages vers le serveur local, zoom 115 %, hauteur 600 px et durée 8 s, sauvegarde confirmée.
- Collection Boîtes Crystal : titre personnalisé, hauteur 440 px et zoom 120 % enregistrés avec son bouton indépendant.
- Formulaire de suggestions envoyé puis message retrouvé dans Suggestions clients.
- Mot de passe administrateur séparé du formulaire d’informations d’entreprise pour éviter l’autoremplissage du navigateur dans les coordonnées.

## Limites

Le lien Sites sans configuration Supabase est une prévisualisation de design. Aucun service Supabase réel du propriétaire, partage Viber/WhatsApp vers un destinataire ni paiement en ligne n’a été activé ou testé. Les tests SQL ne remplacent pas la validation des réglages Auth/Storage de votre propre hébergement. Le lanceur reste sur 127.0.0.1 et n’expose pas la base locale sur les téléphones.

Les captures de promotion montrent des données de vérification. Elles ne représentent pas une offre commerciale réellement activée.

## Lanceurs et distribution

RUN.BAT et DEMARRER-UNIPLAST.bat ont été contrôlés dans un dossier avec espaces, sans dépendances de développement. Démarrage réel, catalogue 350 références sans tarifs visibles pour le visiteur, réutilisation de la même instance et menu 1/5/0 avec arrêt effectif vérifiés. Les chemins de base privée, du serveur, du lanceur et les variantes de traversée encodées répondent 404. Les archives excluent les bases locales et fichiers de connexion.

Le partage Viber suit la documentation officielle : https://developers.viber.com/docs/tools/share-button/ ; le message de code est volontairement court pour conserver téléphone et code dans la limite documentée de 200 caractères. Aucun envoi à un destinataire n’est effectué par le programme.

