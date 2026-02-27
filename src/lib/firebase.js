import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Configuration Firebase
// INSTRUCTION : Remplacez ces valeurs par votre propre configuration Firebase
// 1. Allez sur https://console.firebase.google.com/
// 2. Créez un projet (gratuit)
// 3. Ajoutez une application Web
// 4. Copiez la configuration ici
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef"
}

// Initialiser Firebase
let app = null
let auth = null
let db = null

try {
  console.log('[Firebase] Initialisation avec:', {
    apiKey: firebaseConfig.apiKey ? '✓ défini' : '✗ manquant',
    authDomain: firebaseConfig.authDomain ? '✓ défini' : '✗ manquant',
    projectId: firebaseConfig.projectId ? '✓ défini' : '✗ manquant',
  })
  
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
  
  console.log('[Firebase] ✅ Initialisé avec succès')
} catch (error) {
  console.error('[Firebase] ❌ Erreur d\'initialisation:', error.message)
  console.warn('Vérifiez que les variables d\'environnement VITE_FIREBASE_* sont correctement configurées')
}

export { app, auth, db }
export default app
