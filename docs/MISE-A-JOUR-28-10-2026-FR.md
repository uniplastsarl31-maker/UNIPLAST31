# Mise à jour du catalogue et de l’interface — 28 octobre 2026

Les noms de la nouvelle liste sont la référence pour les produits rapprochés. 343 lignes reçues : **305 produits rapprochés**, **179 noms modifiés**, **38 lignes à vérifier**. Deux prix absents restent sur demande. Le seul tarif à trois décimales, 60.321 DA, est arrondi à 60.32 DA. Les fichiers source et de correspondances sont conservés dans `data/`.

Le fichier reçu comporte seulement `Nom_produit` et `Prix_DA`. Le rapprochement utilise les références intégrées aux noms, le format et la variante. Les variantes incertaines ne sont pas fusionnées. Les codes existants, codes-barres, photos, dimensions et colisages sont conservés.

Le serveur applique `server/catalog-update.json` une seule fois dans la transaction SQLite et la validation CAS Netlify existantes. Il vérifie l’ID et la référence avant chaque changement, conserve un instantané des produits et réglages, et signale les références modifiées par le propriétaire. Une suppression de produit par le propriétaire n’est pas annulée. Les modifications faites après cette version ne sont pas écrasées au déploiement suivant. Les commandes et leur historique sont inchangés. Le bouton **Sauvegarde avant mise à jour** est réservé à l’administration.

Les disponibilités non confirmées deviennent disponibles, sauf stock géré nul ou produit à venir. Un état indisponible déjà confirmé est préservé. Aucun nombre de cartons n’est inventé. Le poids unitaire est facultatif et saisi en grammes. La migration SQL 004 concerne seulement l’ancien mode Supabase ; Netlify n’en a pas besoin.

Le catalogue et la gestion utilisent par défaut l’ordre alphabétique français. Sur un téléphone de 390 × 844 px, deux colonnes et deux rangées compactes sont visibles. Le détail s’ouvre dans une fenêtre, avec miniatures, agrandissement, poids, quantité et ajout au panier. La fermeture conserve le défilement et les filtres. Les promotions conservent leur cadre rouge et un prix/pourcentage visibles sans occuper une rangée entière du catalogue.

**Sans photo** et **Sans prix** facilitent la saisie. Le filtre de budget est réservé aux clients connectés par téléphone/code. Il utilise le prix unitaire courant après remise, avec une borne strictement inférieure. Les visiteurs ne reçoivent aucun prix privé.

La validation des images reconnaît les signatures PNG/JPEG/WebP, y compris si le navigateur fournit un type MIME vide ou `image/x-png`. Le serveur contrôle aussi les octets. Les limites de 4 Mo sur Netlify restent appliquées. Le lecteur de codes-barres privilégie la caméra arrière avec des contraintes souples, permet de choisir la caméra et la torche si disponible, et décode aussi une photo dans quatre orientations. La caméra physique n’a pas été testée sur le téléphone du propriétaire.

Les coordonnées d’UNIPLAST SARL ont été rapprochées des sources publiques listées dans `data/societe-sources-2026-10-28.json`. Aucun email ni numéro WhatsApp n’a été déduit. Les champs déjà personnalisés par le propriétaire sont conservés. L’ancien site Google Business indiqué par un annuaire renvoie 404 ; le lien du site actuel est utilisé.

## Vérification

Tests métier et formats : 15 réussis. Serveur local et migration : 12 réussis. Netlify durable/concurrence/images/permissions : 13 réussis. SQL historique avec migration 004 : 23 réussis. Constructions locale, aperçu web et Netlify réussies.

Le contrôle dans le navigateur a confirmé les tarifs après connexion téléphone/code, le filtre inférieur à 100 DA, la conservation du défilement et du filtre à la fermeture, les miniatures et le zoom, la lecture d’un EAN-13 depuis une image, et le téléversement/sauvegarde d’un vrai PNG avec extension majuscule. Photo et poids d’essai ont persisté après rechargement dans une base isolée en mémoire.

## Installation

Copier le contenu de l’archive de mise à jour dans la racine du dépôt GitHub Desktop existant, puis **Commit to main → Push origin**. Attendre **Published** dans Netlify. Aucun nouveau compte administrateur ni nouvelle variable d’installation n’est nécessaire. Ne pas remplacer le magasin par l’archive complète pour une mise à jour ordinaire.

Cette version a été vérifiée localement et n’a pas été publiée sur le compte du propriétaire lors de la préparation.
