# 🚀 Déploiement GitHub Pages - Instructions

## ✅ Configuration terminée

Votre application est prête à être déployée automatiquement sur GitHub Pages !

## 📋 Étapes à suivre

### 1️⃣ Activer GitHub Pages

1. Allez sur **https://github.com/bjacky94-alt/fact-app**
2. Cliquez sur **Settings** (⚙️ Paramètres)
3. Dans le menu latéral, cliquez sur **Pages**
4. Sous **"Source"**, sélectionnez **"GitHub Actions"**
5. C'est tout pour cette étape ! ✅

### 2️⃣ Ajouter les secrets Firebase

Pour que votre app fonctionne en ligne avec Firebase, vous devez ajouter vos clés comme **secrets** :

1. Toujours dans **Settings** → **Secrets and variables** → **Actions**
2. Cliquez sur **"New repository secret"**
3. Ajoutez **un par un** ces 6 secrets :

| Nom du secret | Valeur à coller |
|---------------|-----------------|
| `VITE_FIREBASE_API_KEY` | `AIzaSyCPhVHaJaqQcM_Z9YvUyhpsOY_AoWceKDs` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `facturation-e606a.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `facturation-e606a` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `facturation-e606a.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `1071675243255` |
| `VITE_FIREBASE_APP_ID` | `1:1071675243255:web:866acd2abf86c55b5171f2` |

**Pour chaque secret** :
- Cliquez sur **"New repository secret"**
- Collez le **nom** (ex: `VITE_FIREBASE_API_KEY`)
- Collez la **valeur** correspondante
- Cliquez sur **"Add secret"**
- Recommencez pour les 6 secrets

### 3️⃣ Pousser le code sur GitHub

Une fois les secrets configurés, poussez votre code :

```bash
git add .
git commit -m "Configuration déploiement GitHub Pages + Firebase cloud sync"
git push origin main
```

### 4️⃣ Vérifier le déploiement

1. Allez dans l'onglet **"Actions"** de votre repo GitHub
2. Vous verrez le workflow **"Déploiement GitHub Pages"** en cours
3. Attendez quelques minutes (🟡 jaune → ✅ vert)
4. Votre app sera en ligne ! 🎉

## 🌐 URL de votre application

Une fois déployé, votre application sera accessible à :

**https://bjacky94-alt.github.io/fact-app/**

## 🔄 Mises à jour automatiques

À chaque fois que vous ferez un `git push` sur la branche `main`, votre application sera **automatiquement redéployée** !

## ⚠️ Important

- Les secrets sont **sécurisés** et ne seront jamais affichés publiquement
- Votre fichier `.env` local n'est **pas** poussé sur GitHub (protégé par `.gitignore`)
- L'application utilisera les secrets GitHub pour la production

## 📱 Utilisation

Vous pourrez utiliser votre application :
- 💻 Depuis n'importe quel navigateur
- 📱 Sur mobile (ajoutez à l'écran d'accueil)
- 🌍 De n'importe où dans le monde
- ☁️ Avec synchronisation cloud

## 🆘 Résolution de problèmes

**Le build échoue ?**
- Vérifiez que tous les 6 secrets sont bien ajoutés
- Les noms doivent être **exactement** comme indiqué (sensible à la casse)

**L'app ne fonctionne pas en ligne ?**
- Vérifiez les secrets Firebase
- Ouvrez la console du navigateur (F12) pour voir les erreurs

**GitHub Pages ne se déploie pas ?**
- Vérifiez que "GitHub Actions" est bien sélectionné dans Settings > Pages

---

**Besoin d'aide ? Dites-moi où vous en êtes !** 🚀
