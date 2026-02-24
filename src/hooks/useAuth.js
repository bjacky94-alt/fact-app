import { useState, useEffect } from 'react'
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import { enableCloudSync, disableCloudSync } from '../lib/cloudSync'

export const useAuth = () => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)

      if (firebaseUser) {
        // Activer la synchronisation
        await enableCloudSync(firebaseUser.uid)
      } else {
        // Désactiver la synchronisation
        disableCloudSync()
      }
    })

    return () => unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    if (!auth) {
      setError('Firebase non configuré')
      return false
    }

    try {
      setError(null)
      await signInWithEmailAndPassword(auth, email, password)
      return true
    } catch (err) {
      console.error('Erreur connexion:', err)
      setError(getErrorMessage(err.code))
      return false
    }
  }

  const signUp = async (email, password) => {
    if (!auth) {
      setError('Firebase non configuré')
      return false
    }

    try {
      setError(null)
      await createUserWithEmailAndPassword(auth, email, password)
      return true
    } catch (err) {
      console.error('Erreur inscription:', err)
      setError(getErrorMessage(err.code))
      return false
    }
  }

  const signOut = async () => {
    if (!auth) return

    try {
      await firebaseSignOut(auth)
      disableCloudSync()
    } catch (err) {
      console.error('Erreur déconnexion:', err)
    }
  }

  return {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut
  }
}

// Messages d'erreur en français
const getErrorMessage = (code) => {
  const messages = {
    'auth/email-already-in-use': 'Cet email est déjà utilisé',
    'auth/invalid-email': 'Email invalide',
    'auth/operation-not-allowed': 'Opération non autorisée',
    'auth/weak-password': 'Mot de passe trop faible (min 6 caractères)',
    'auth/user-disabled': 'Compte désactivé',
    'auth/user-not-found': 'Email ou mot de passe incorrect',
    'auth/wrong-password': 'Email ou mot de passe incorrect',
    'auth/invalid-credential': 'Identifiants invalides',
    'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard',
    'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion'
  }

  return messages[code] || 'Une erreur est survenue'
}
