# 🚀 CONFIGURATION CLOUD - Instructions

Votre application dispose maintenant de la **synchronisation cloud** ! 🎉

## ✅ Fonctionnalités ajoutées

- 🔐 **Authentification** par email/mot de passe
- ☁️ **Synchronisation automatique** de toutes vos données
- 📱 **Accès multi-appareils** : connexion depuis n'importe où
- 💾 **Sauvegarde automatique** dans le cloud
- 🔄 **Synchronisation en temps réel** entre vos appareils

## 📋 Configuration Firebase (Gratuit)

### Étape 1 : Créer un projet Firebase

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Cliquez sur **"Ajouter un projet"**
3. Donnez un nom à votre projet (ex: "fact-app")
4. Désactivez Google Analytics (optionnel)
5. Cliquez sur **"Créer le projet"**

### Étape 2 : Activer l'authentification

1. Dans le menu latéral, cliquez sur **"Authentication"**
2. Cliquez sur **"Commencer"**
3. Dans l'onglet **"Sign-in method"**
4. Activez **"E-mail/Mot de passe"**
5. Cliquez sur **"Enregistrer"**

### Étape 3 : Créer une base de données Firestore

1. Dans le menu latéral, cliquez sur **"Firestore Database"**
2. Cliquez sur **"Créer une base de données"**
3. Choisissez **"Démarrer en mode test"** (ou production si vous préférez)
4. Sélectionnez une région proche de vous (ex: europe-west1)
5. Cliquez sur **"Activer"**

### Étape 4 : Configurer les règles de sécurité

1. Dans Firestore, allez dans l'onglet **"Règles"**
2. Remplacez le contenu par :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Cliquez sur **"Publier"**

### Étape 5 : Obtenir la configuration

1. Cliquez sur l'icône **⚙️ Paramètres** (roue dentée) en haut à gauche
2. Allez dans **"Paramètres du projet"**
3. Faites défiler jusqu'à **"Vos applications"**
4. Cliquez sur l'icône **</>** (Web)
5. Donnez un nom à votre app (ex: "fact-app-web")
6. Copiez la configuration qui apparaît

### Étape 6 : Configurer votre application

1. Dans votre projet, créez un fichier `.env` à la racine
2. Copiez le contenu de `.env.example`
3. Remplacez les valeurs par celles de Firebase :

```env
VITE_FIREBASE_API_KEY=AIzaSyC...
VITE_FIREBASE_AUTH_DOMAIN=votre-projet.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=votre-projet-id
VITE_FIREBASE_STORAGE_BUCKET=votre-projet.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

4. **Redémarrez le serveur de développement** :
```bash
npm run dev
```

## 🎯 Utilisation

### Première connexion

1. Lancez votre application
2. Cliquez sur **"Connexion"** dans la barre latérale
3. Créez un compte avec votre email et un mot de passe
4. Vous êtes connecté ! ✅

### Synchronisation automatique

- Toutes vos données sont **automatiquement sauvegardées** dans le cloud
- Connectez-vous depuis un autre appareil → vos données sont là ! 🎉
- Les modifications sont **synchronisées en temps réel**

### Mode hors ligne

- Vous pouvez utiliser l'app **sans compte** (mode hors ligne)
- Cliquez sur **"Continuer sans compte"** sur la page de connexion
- Vos données restent sur votre appareil uniquement

## 💰 Limites gratuites Firebase

Le plan gratuit de Firebase inclut :
- ✅ **50 000 lectures/jour** 
- ✅ **20 000 écritures/jour**
- ✅ **1 GB de stockage**
- ✅ **Largement suffisant** pour une utilisation personnelle

## 🔒 Sécurité

- Les données sont **chiffrées en transit** (HTTPS)
- Chaque utilisateur n'accède qu'à **ses propres données**
- Les règles Firestore empêchent tout accès non autorisé

## 📱 Déploiement

Pour mettre l'application en ligne (GitHub Pages, Vercel, etc.) :
- Les variables d'environnement doivent être configurées sur la plateforme
- Testez localement avant de déployer

## ❓ Questions fréquentes

**Q : Puis-je utiliser plusieurs appareils ?**
A : Oui ! Connectez-vous avec le même compte sur tous vos appareils.

**Q : Que se passe-t-il si je perds ma connexion internet ?**
A : L'app continue de fonctionner hors ligne. Les données seront synchronisées à la reconnexion.

**Q : Puis-je exporter mes données ?**
A : Oui ! La fonction d'export existe toujours dans Paramètres.

**Q : Et si je veux changer de compte ?**
A : Déconnectez-vous et reconnectez-vous avec un autre compte.

## 🆘 Support

En cas de problème :
1. Vérifiez que votre fichier `.env` est bien configuré
2. Vérifiez que Authentication et Firestore sont activés dans Firebase
3. Regardez la console du navigateur (F12) pour les erreurs
4. Vérifiez les règles de sécurité Firestore

---

**Profitez de votre application avec synchronisation cloud ! 🚀**
