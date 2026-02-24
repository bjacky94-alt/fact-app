import { useState, useEffect } from 'react'
import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { getSyncStatus, syncNow } from '../lib/cloudSync'

export default function CloudSyncStatus() {
  const [status, setStatus] = useState(getSyncStatus())
  const [syncing, setSyncing] = useState(false)

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

  const handleSync = async () => {
    setSyncing(true)
    await syncNow()
    setTimeout(() => setSyncing(false), 1000)
  }

  if (!status.enabled) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <CloudOff size={16} />
        <span>Hors ligne</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-sm text-green-600">
      <Cloud size={16} />
      <span>Synchronisé</span>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
        title="Synchroniser maintenant"
      >
        <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
      </button>
    </div>
  )
}
