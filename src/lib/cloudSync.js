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

  // Vérifier s'il y a des données locales
  const hasLocalData = SYNC_KEYS.some(key => localStorage.getItem(key) !== null)
  
  // D'abord, charger les données du cloud
  console.log('📥 Chargement des données du cloud...')
  const hadCloudData = await pullFromCloud()

  // Ensuite, envoyer les données locales vers le cloud
  // (pour fusionner ou sauvegarder les données locales)
  if (hasLocalData) {
    console.log('📤 Sauvegarde des données locales vers le cloud...')
    await pushToCloud()
  } else if (!hadCloudData) {
    console.log('ℹ️ Aucune donnée locale ou cloud trouvée')
  }

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
 * Enlever les justificatifs (trop volumineux pour Firestore)
 */
const stripReceipts = (dataStr) => {
  try {
    const parsed = JSON.parse(dataStr)
    if (!Array.isArray(parsed)) return dataStr
    
    // Filtrer les receiptDataUrl des dépenses
    const stripped = parsed.map(item => {
      if (item.receiptDataUrl) {
        const { receiptDataUrl, ...rest } = item
        return rest
      }
      return item
    })
    
    return JSON.stringify(stripped)
  } catch {
    return dataStr
  }
}

/**
 * Envoyer les données locales vers le cloud
 */
export const pushToCloud = async () => {
  console.log('🔄 Début de la sauvegarde...')
  
  if (!db) {
    const error = 'Firebase non configuré. Vérifiez les variables d\'environnement.';
    console.error('❌', error)
    throw new Error(error)
  }
  
  if (!syncEnabled || !currentUserId) {
    const error = 'Utilisateur non connecté. Connectez-vous d\'abord.';
    console.error('❌', error)
    throw new Error(error)
  }

  try {
    const data = {}
    for (const key of SYNC_KEYS) {
      const value = localStorage.getItem(key)
      if (value !== null) {
        // Filtrer les justificatifs pour les dépenses
        if (key === 'nodebox_expenses') {
          data[key] = stripReceipts(value)
          console.log('⚠️ Justificatifs exclus de la sync cloud (restent en local)')
        } else {
          data[key] = value
        }
      }
    }

    const payload = {
      data,
      lastSync: new Date().toISOString()
    }
    const payloadSize = new Blob([JSON.stringify(payload)]).size

    console.log('📦 Données à sauvegarder:', Object.keys(data))
    console.log(`📏 Taille payload: ${(payloadSize / 1024).toFixed(2)} Ko`)
    
    // Vérifier la taille (max ~800 Ko pour sécurité, limite Firestore = 1 Mo)
    if (payloadSize > 800000) {
      throw new Error(`Données trop volumineuses (${(payloadSize / 1024).toFixed(2)} Ko). Contactez le support.`)
    }
    
    const userDocRef = doc(db, 'users', currentUserId)
    
    // Ajouter un timeout de 60 secondes
    const savePromise = setDoc(userDocRef, payload, { merge: true })

    let timeoutId
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Timeout: La sauvegarde prend trop de temps'))
      }, 60000)
    })

    await Promise.race([savePromise, timeoutPromise])
    clearTimeout(timeoutId)

    console.log('✅ Données synchronisées vers le cloud')
    return true
  } catch (error) {
    console.error('❌ Erreur sync cloud:', error)
    console.error('Détails:', error.message)
    
    // Messages d'erreur plus explicites
    if (error.code === 'permission-denied') {
      throw new Error('Permission refusée. Vérifiez vos règles Firestore.')
    } else if (error.code === 'unavailable') {
      throw new Error('Service Firebase indisponible. Vérifiez votre connexion.')
    } else if (error.message.includes('Timeout')) {
      throw new Error('La sauvegarde prend trop de temps. Essayez de réduire vos données.')
    } else {
      throw new Error(error.message || 'Erreur inconnue lors de la sauvegarde')
    }
  }
}

/**
 * Récupérer les données du cloud
 * @returns {Promise<boolean>} true si des données existent dans le cloud, false sinon
 */
export const pullFromCloud = async () => {
  if (!syncEnabled || !currentUserId || !db) return false

  try {
    const userDocRef = doc(db, 'users', currentUserId)
    const docSnap = await getDoc(userDocRef)

    if (docSnap.exists()) {
      const cloudData = docSnap.data().data || {}
      
      // Vérifier s'il y a vraiment des données
      const hasData = Object.keys(cloudData).length > 0
      
      if (hasData) {
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
