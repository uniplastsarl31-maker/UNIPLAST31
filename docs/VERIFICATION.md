# Vérification Netlify — 28 octobre 2026

- `pnpm test` : 10 tests réussis ; `pnpm test:local` : 11 ; `pnpm test:netlify` : 12.
- TypeScript et builds `dist`, `out`, `dist-netlify` réussis sur Node.js 24.19.0.
- Fonction shop préparée par @netlify/zip-it-and-ship-it 16.6.0 : runtime nodejs24.x, API v2, route /api/local/*.
- Chargement de la fonction empaquetée avec @netlify/blobs 11.1.7 réel, réseau Blobs simulé : catalogue 350 références, écritures If-Match / If-None-Match, conservation des réglages et isolation production / Deploy Preview vérifiées. Les options expérimentales de détection et require-module ont été désactivées comme dans Lambda.
- Tests de stockage isolé : six commandes concurrentes pour trois cartons produisent trois commandes, sans dépassement ; même clé rejouée sans double réservation ; fichiers durables et privés ; conflit d’upload nettoyé puis réessayé ; erreurs et limites de connexion sauvegardées même après HTTP 401.
- Installation non revendicable sans clé privée du propriétaire ; clé jamais renvoyée par status. Cookies Secure, HttpOnly et SameSite=Strict. Révocation, rotation et déconnexion vérifiées.
- Contrôle navigateur de la version Netlify dans une simulation locale : accueil chargé, accès du responsable à la gestion et formulaire téléphone / six chiffres sans inscription, aucun débordement horizontal à 390 × 844.
- Les tests utilisent uniquement une base jetable hors des archives. Aucun test n’est exécuté sur les données du propriétaire.

Le compilateur natif Windows refusait la lecture d’un répertoire parent ; le contrôle d’empaquetage a utilisé la variante WASM officielle de la même version d’esbuild dans les outils de vérification uniquement. Le projet livré n’est pas modifié par ce contournement de compilation local.

Le déploiement réel sur le compte Netlify du propriétaire reste à effectuer et à contrôler. Les validations ci-dessus ne constituent pas une confirmation de mise en ligne.

---

## Historique de la version locale — 27 octobre 2026

Les sections suivantes décrivent les vérifications antérieures de RUN.BAT et de l’adaptateur Supabase optionnel. Le chemin Netlify ci-dessus remplace la nécessité de configurer Supabase pour le déploiement actuel.

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

