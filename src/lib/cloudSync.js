import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'

// Clés localStorage à synchroniser
const SYNC_KEYS = [
  'nodebox_invoices',
  'nodebox_expenses',
  'fact_leaves_v2',
  'nodebox_treasury',
  'nodebox_settings',
  'nodebox_urssaf',
  'nodebox_tax'
]

// État de synchronisation
let syncEnabled = false
let currentUserId = null
let unsubscribeFns = []

/**
 * Activer la synchronisation cloud pour un utilisateur
 */
export const enableCloudSync = async (userId) => {
  if (!db || !userId) {
    console.warn('Cloud sync not available')
    return false
  }

  currentUserId = userId
  syncEnabled = true

  // Charger les données du cloud au démarrage
  await pullFromCloud()

  // Écouter les changements du cloud
  listenToCloudChanges()

  // Écouter les changements locaux
  listenToLocalChanges()

  return true
}

/**
 * Désactiver la synchronisation
 */
export const disableCloudSync = () => {
  syncEnabled = false
  currentUserId = null
  
  // Arrêter tous les listeners
  unsubscribeFns.forEach(fn => fn())
  unsubscribeFns = []
}

/**
 * Envoyer les données locales vers le cloud
 */
export const pushToCloud = async () => {
  if (!syncEnabled || !currentUserId || !db) return false

  try {
    const data = {}
    for (const key of SYNC_KEYS) {
      const value = localStorage.getItem(key)
      if (value !== null) {
        data[key] = value
      }
    }

    const userDocRef = doc(db, 'users', currentUserId)
    await setDoc(userDocRef, {
      data,
      lastSync: new Date().toISOString()
    }, { merge: true })

    console.log('✅ Données synchronisées vers le cloud')
    return true
  } catch (error) {
    console.error('❌ Erreur sync cloud:', error)
    return false
  }
}

/**
 * Récupérer les données du cloud
 */
export const pullFromCloud = async () => {
  if (!syncEnabled || !currentUserId || !db) return false

  try {
    const userDocRef = doc(db, 'users', currentUserId)
    const docSnap = await getDoc(userDocRef)

    if (docSnap.exists()) {
      const cloudData = docSnap.data().data || {}
      
      // Fusionner avec les données locales
      for (const key of SYNC_KEYS) {
        if (cloudData[key] !== undefined) {
          localStorage.setItem(key, cloudData[key])
        }
      }

      console.log('✅ Données récupérées du cloud')
      window.dispatchEvent(new Event('cloudSyncUpdate'))
      return true
    }
  } catch (error) {
    console.error('❌ Erreur récupération cloud:', error)
    return false
  }

  return false
}

/**
 * Écouter les changements du cloud en temps réel
 */
const listenToCloudChanges = () => {
  if (!syncEnabled || !currentUserId || !db) return

  const userDocRef = doc(db, 'users', currentUserId)
  
  const unsubscribe = onSnapshot(userDocRef, (doc) => {
    if (doc.exists()) {
      const cloudData = doc.data().data || {}
      let hasChanges = false

      for (const key of SYNC_KEYS) {
        const cloudValue = cloudData[key]
        const localValue = localStorage.getItem(key)

        if (cloudValue !== undefined && cloudValue !== localValue) {
          localStorage.setItem(key, cloudValue)
          hasChanges = true
        }
      }

      if (hasChanges) {
        console.log('🔄 Données mises à jour depuis le cloud')
        window.dispatchEvent(new Event('cloudSyncUpdate'))
      }
    }
  })

  unsubscribeFns.push(unsubscribe)
}

/**
 * Écouter les changements locaux pour sync automatique
 */
const listenToLocalChanges = () => {
  // Détecter les changements localStorage
  let debounceTimer = null
  
  const handleStorageChange = () => {
    if (!syncEnabled) return
    
    // Debounce pour éviter trop de syncs
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      pushToCloud()
    }, 2000) // Sync après 2 secondes d'inactivité
  }

  // Écouter les changements de storage
  window.addEventListener('storage', handleStorageChange)
  
  // Patch setItem pour détecter les changements locaux
  const originalSetItem = localStorage.setItem.bind(localStorage)
  localStorage.setItem = function(key, value) {
    originalSetItem(key, value)
    if (SYNC_KEYS.includes(key)) {
      handleStorageChange()
    }
  }

  unsubscribeFns.push(() => {
    window.removeEventListener('storage', handleStorageChange)
    localStorage.setItem = originalSetItem
  })
}

/**
 * Statut de la synchronisation
 */
export const getSyncStatus = () => ({
  enabled: syncEnabled,
  userId: currentUserId
})

/**
 * Synchronisation manuelle immédiate
 */
export const syncNow = async () => {
  await pushToCloud()
  await pullFromCloud()
}
