> Livraison du 7 novembre 2026 : poids sélectifs PDF/Excel, transfert XLSX protégé, signature et vidéos, PDF/vidéo20MiB par parties. Mise à jour préparée localement ; aucun push GitHub ni déploiement Netlify n’a été effectué. Les tests actuels couvrent la conservation des photos/données, les conflits et un PDF20MiB complet. Les résultats des anciennes versions ci-dessous sont conservés pour traçabilité.

> Complément du 3 novembre 2026 : cadres photo, cercle au premier plan, aperçu direct et transitions. 20 tests domaine/fichiers et 29 tests locaux/Netlify passent. Ce complément est préparé localement, sans publication. Les contrôles de la livraison précédente sont conservés ci-dessous pour traçabilité.

# État de livraison — 2 novembre 2026

Cette mise à jour est préparée pour **Netlify Functions + Blobs** et le mode local indépendant **RUN.BAT**. Elle ajoute les huit familles demandées, une sélection automatique Nouveaux produits, une pastille NOUVEAU avec fin facultative, des visuels par famille, des conditions de fabrication et des options d’affichage des caractéristiques.

La base de comparaison est la copie locale propre de UNIPLAST31, commit `01f972ca24fc502e6dbb1b12ac08ea0822a8fb5d`, située sur le Bureau du propriétaire et copiée sans ses données privées dans l’espace de travail. L’état distant actuel de GitHub n’est pas attesté par ce contrôle local.

**Cette nouvelle livraison n’a pas été poussée sur GitHub ni publiée sur Netlify.** Le propriétaire peut copier le contenu de l’archive de mise à jour dans son dépôt principal, faire Commit to main puis Push origin et attendre Published. Aucun changement des secrets Netlify ni nouvelle initialisation de l’administration n’est demandé pour cette mise à jour d’un magasin déjà installé.

Les données persistantes du magasin publié, les comptes et les fichiers privés sont absents de l’archive. La migration des familles sauvegarde leur état précédent et s’applique une fois dans le stockage existant. L’identité Sites antérieure est conservée sans publication Sites.

La construction locale, l’aperçu et la construction Netlify réussissent. Les 18 tests de domaine/fichiers, 14 tests locaux/migrations, 14 tests Netlify et 23 tests SQL existants réussissent. La fonction assemblée avec l’outil Netlify et le SDK Blobs a aussi été exécutée sur un stockage de test isolé. Ces contrôles ne prouvent pas un déploiement réel.

La vérification du navigateur a couvert le format téléphone 390 × 844, quatre cartes visibles, la pastille NOUVEAU, le détail et le retour au même défilement, les champs masqués, le formulaire de deux articles avec photos privées, sa consultation dans la gestion, la date de fin et un PNG dans un diaporama en mode affiche complète. Le défilement automatique a été observé. Aucune caméra physique de téléphone n’a été utilisée dans cet essai.

Installation et utilisation : [guide français](MISE-A-JOUR-02-11-2026-FR.md) et [guide arabe](MISE-A-JOUR-02-11-2026-AR.md).
