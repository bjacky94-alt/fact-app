# 📊 FACT-APP - Application de Facturation et Pilotage

Application complète de gestion de facturation pour freelances et micro-entrepreneurs.

## ✨ Fonctionnalités

### 📋 Gestion
- **Factures** : Création, suivi, et génération PDF
- **Dépenses** : Gestion des frais avec pièces jointes
- **Congés** : Suivi des jours de congés
- **Trésorerie** : Vue d'ensemble de vos finances
- **Impôts & URSSAF** : Calculs automatiques

### ☁️ Synchronisation Cloud (NOUVEAU !)
- 🔐 Authentification sécurisée
- 📱 Accès depuis tous vos appareils
- 🔄 Synchronisation automatique en temps réel
- 💾 Sauvegarde automatique dans le cloud
- 💾 Sauvegarde et restauration des données

### 🎨 Interface
- Design moderne et responsive
- Thème clair/sombre
- Synthèse financière en temps réel

## 🚀 Installation

```bash
# Installer les dépendances
npm install

# Lancer en développement
npm run dev

# Build pour production
npm run build
```

## ☁️ Configuration Cloud (Optionnel)

Pour activer la synchronisation cloud, consultez le guide complet : [CLOUD_SETUP.md](./CLOUD_SETUP.md)

**Résumé rapide :**
1. Créez un projet Firebase (gratuit)
2. Copiez `.env.example` vers `.env`
3. Ajoutez vos clés Firebase
4. Redémarrez l'application

Sans configuration cloud, l'application fonctionne en mode **hors ligne** avec stockage local.

## 📦 Technologies

- **React 18** - Framework UI
- **React Router** - Navigation
- **Vite** - Build tool
- **Firebase** - Cloud sync & auth
- **jsPDF** - Génération PDF
- **Lucide React** - Icônes

## 📝 Structure du projet

```
src/
├── app/           # Router
├── components/    # Composants réutilisables
├── hooks/         # Hooks personnalisés (useAuth)
├── layout/        # Layout principal
├── lib/           # Logique métier (invoices, expenses, cloudSync)
├── pages/         # Pages de l'application
└── theme/         # Thèmes et styles
```

## 💾 Données

### Mode hors ligne (par défaut)
Les données sont stockées dans le navigateur (localStorage). Pensez à faire une sauvegarde régulière depuis **Paramètres → Sauvegarde complète**.

### Mode cloud (avec Firebase)
Les données sont automatiquement synchronisées dans le cloud et accessibles depuis tous vos appareils.

## 🚀 Déploiement

L'application peut être déployée sur :
- **Vercel** (recommandé)
- **Netlify**
- **GitHub Pages**

Pour GitHub Pages, ajoutez dans [vite.config.js](vite.config.js) :
```javascript
export default defineConfig({
  base: '/fact-app/',
  // ...
})
```

## 🔒 Sécurité

- Authentification Firebase sécurisée
- Chiffrement HTTPS
- Règles de sécurité Firestore
- Isolation des données utilisateur

## 📄 Licence

MIT

---

Développé avec ❤️ pour les freelances
