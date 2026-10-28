# UNIPLAST sur Netlify — installation

Cette version utilise Netlify pour le site, l’API et la conservation des données. Le catalogue est initialisé une seule fois avec 350 références et 17 collections. Aucun client, mot de passe, stock disponible ou promotion de test n’est installé.

## 1. Mettre à jour GitHub

Ouvrez votre dépôt **uniplastsarl31-maker/UNIPLAST31**. Extrayez l’archive de mise à jour, puis utilisez **Add file → Upload files**. Déposez son contenu en conservant les sous-dossiers et validez avec **Commit changes**. Les fichiers `netlify.toml` et `package.json` doivent être au même niveau, à la racine du dépôt. Ne déposez pas le ZIP fermé et n’ajoutez pas un dossier supplémentaire autour des fichiers.

L’archive de mise à jour contient uniquement les fichiers du correctif. Elle conserve vos autres fichiers du dépôt. Le projet complet est fourni séparément pour une installation neuve. N’envoyez jamais `.uniplast-data`, `.env`, `node_modules` ou une sauvegarde de clients à GitHub.

## 2. Configuration de Netlify

Dans votre projet **uniplast-dz**, vérifiez les réglages de construction. Le fichier `netlify.toml` fournit :

| Champ | Valeur |
| --- | --- |
| Base directory | Racine du dépôt (laisser vide) |
| Build command | `pnpm run build:netlify` |
| Publish directory | `dist-netlify` |
| Functions directory | `netlify/functions` |
| Node.js | `24` |

Dans **Project configuration → Environment variables**, ajoutez :

| Nom | Valeur / portée |
| --- | --- |
| `AWS_LAMBDA_JS_RUNTIME` | `nodejs24.x`, disponible pour Functions |
| `UNIPLAST_SETUP_KEY` | Une clé privée que vous choisissez, 24–256 caractères, disponible pour Functions |

Utilisez une clé aléatoire de votre gestionnaire de mots de passe et gardez-la privée. Elle autorise la première création du responsable. Ce n’est ni le code d’un client ni la future connexion quotidienne du responsable. Ne la partagez pas dans GitHub ou le chat, et n’utilisez pas un nom commençant par `VITE_`.

Aucune clé Supabase ni clé personnelle Netlify n’est nécessaire dans le navigateur. Les identifiants de Blobs sont fournis automatiquement aux fonctions par Netlify. Gardez le même projet Netlify pour conserver ses données.

Dans **Deploys**, déclenchez une nouvelle construction du dernier commit. Attendez sa réussite et vérifiez que la fonction **shop** apparaît. Un simple dépôt manuel du dossier `dist` ne déploie pas ce serveur.

## 3. Créer votre accès de gestion

Sur **https://uniplast-dz.netlify.app/**, ouvrez **Espace de gestion → Se connecter**.

À la première installation : entrez la clé privée définie dans Netlify, choisissez votre mot de passe administrateur (12–128 caractères), confirmez-le, puis validez. Personne ne peut créer cet accès avec le seul lien public. Si la clé n’est pas configurée, la création reste désactivée ; le catalogue public continue de fonctionner.

Après cette installation, seul votre mot de passe administrateur est demandé. Vous pouvez supprimer `UNIPLAST_SETUP_KEY` de Netlify puis redéployer : l’accès créé et les données restent conservés. La suppression de la clé n’est pas une réinitialisation du mot de passe.

Dans **Clients agréés**, enregistrez le nom, le téléphone et un code de six chiffres. Envoyez vous-même le code au bon destinataire. Le client utilise **Client agréé → téléphone + code** pour voir les tarifs. Les visiteurs n’ont pas besoin de compte pour parcourir le catalogue ou proposer une idée.

## Conservation, fichiers et limites

- Les produits, collections, réglages, accès, commandes et suggestions sont conservés dans le store privé `uniplast-state-v1`. Les fichiers sont dans `uniplast-files-v1`.
- Le fichier SQLite n’est jamais servi au navigateur. Chaque requête travaille sur une copie temporaire, puis une écriture conditionnelle avec ETag valide les changements. Un conflit relit l’état récent et réessaie ; les commandes vérifient à nouveau les prix et le stock.
- Les redéploiements du même projet utilisent les données existantes sans remplacer le catalogue. Les Deploy Previews utilisent des stores séparés par déploiement, sans lire les clients ou commandes de production.
- Les données de RUN.BAT restent sur le PC et ne sont pas transférées automatiquement. Le premier démarrage en ligne part du catalogue source livré.
- Images JPG/PNG/WebP et PDF : **4 Mo par fichier** dans cette version. Cette limite tient compte des requêtes binaires des Functions et s’applique aussi après une montée de forfait. Le catalogue PDF publié est visible par tous : utilisez un document sans tarifs si ceux-ci sont réservés.
- Les codes sont hachés, les sessions utilisent des cookies Secure/HttpOnly, et la rotation d’un code ou sa désactivation révoque ses sessions. Les pièces jointes privées sont accessibles uniquement à leur propriétaire et à l’administration.
- Pour une sauvegarde privée, téléchargez `store.sqlite` et tous les fichiers des deux stores depuis l’interface Blobs de Netlify. Une copie du code ne sauvegarde pas vos commandes. Conservez-les ensemble, hors du dépôt public.
- La formule gratuite permet l’essai dans ses quotas. Surveillez l’usage dans votre compte ; aucun abonnement ni recharge payante n’est activé par ce correctif. La charge de stockage augmente avec les commandes ; vérifiez l’usage avant l’ouverture commerciale.

## Vérifier après la mise en ligne

1. Ouvrez `/api/local/health` sur votre domaine : il doit répondre en JSON avec `ok: true` et `storage: "netlify-blobs"`.
2. Le catalogue affiche ses familles et produits ; un visiteur ne reçoit pas les montants réservés.
3. Créez votre responsable, un accès client et un réglage de présentation. Rechargez puis utilisez un autre téléphone pour vérifier la conservation et le partage.
4. Effectuez une commande d’essai avec un produit dont vous avez confirmé le prix, le colisage et la disponibilité. Vérifiez les totaux, le stock et l’historique.
5. Redéployez le même projet et contrôlez à nouveau ces données.

Si `/api/local/health` affiche du HTML ou 404 : le déploiement n’a pas inclus la fonction ou utilise un ancien commit. Vérifiez le fichier racine, la commande, le répertoire de publication et les journaux du build. Si l’API répond 503, consultez les journaux de **shop** et l’accès Blobs. Une erreur Netlify ne demande jamais de lancer RUN.BAT.

## Références officielles

- [Netlify Blobs : conservation et écritures conditionnelles](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
- [Functions : routage, Node.js et limite des fichiers](https://docs.netlify.com/build/functions/configuration/)
- [Fonctions et stockage inclus dans les plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)
