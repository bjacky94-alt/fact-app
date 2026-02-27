import { useState, useEffect } from 'react'
import { Cloud, CloudOff, Upload } from 'lucide-react'
import { getSyncStatus, pushToCloud } from '../lib/cloudSync'

export default function CloudSyncStatus() {
  const [status, setStatus] = useState(getSyncStatus())
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handleUpdate = () => {
      setStatus(getSyncStatus())
    }

    window.addEventListener('cloudSyncUpdate', handleUpdate)
    
    const interval = setInterval(handleUpdate, 5000)

    return () => {
      window.removeEventListener('cloudSyncUpdate', handleUpdate)
      clearInterval(interval)
    }
  }, [])

  const handleSaveToCloud = async () => {
    setSyncing(true)
    setMessage('Sauvegarde...')
    
    console.log('🚀 Bouton cliqué - début sauvegarde')
    
    try {
      const success = await pushToCloud()
      
      if (success) {
        setMessage('✅ Données sauvegardées !')
        console.log('✅ Sauvegarde terminée avec succès')
      } else {
        setMessage('❌ Erreur de sauvegarde')
        console.error('❌ La sauvegarde a échoué')
      }
    } catch (error) {
      setMessage('❌ Erreur: ' + error.message)
      console.error('❌ Exception lors de la sauvegarde:', error)
    }
    
    setTimeout(() => {
      setSyncing(false)
      setMessage('')
    }, 3000)
  }

  if (!status.enabled) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        fontSize: '13px', 
        color: 'var(--muted)',
        marginBottom: '8px'
      }}>
        <CloudOff size={16} />
        <span>Hors ligne</span>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        fontSize: '13px', 
        color: '#10b981',
        marginBottom: '10px'
      }}>
        <Cloud size={16} />
        <span>Connecté au cloud</span>
      </div>
      
      <button
        onClick={handleSaveToCloud}
        disabled={syncing}
        style={{
          width: '100%',
          padding: '10px',
          background: syncing ? '#94a3b8' : '#4f46e5',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: '600',
          cursor: syncing ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.2s ease',
          opacity: syncing ? 0.6 : 1
        }}
        onMouseOver={(e) => {
          if (!syncing) e.currentTarget.style.background = '#4338ca'
        }}
        onMouseOut={(e) => {
          if (!syncing) e.currentTarget.style.background = '#4f46e5'
        }}
        title="Sauvegarder toutes les données dans le cloud"
      >
        <Upload size={16} />
        <span>{syncing ? 'Sauvegarde...' : 'Sauvegarder au cloud'}</span>
      </button>
      
      {message && (
        <div style={{ 
          fontSize: '12px', 
          textAlign: 'center', 
          marginTop: '8px',
          fontWeight: '500',
          color: message.includes('✅') ? '#10b981' : '#ef4444'
        }}>
          {message}
        </div>
      )}
    </div>
  )
}
