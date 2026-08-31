import { useState, useEffect } from 'react'
import { on, EVENTS } from '@/lib/events'

// Subscribe to the backend's off-thread `import:progress` stream. Shared by every
// import flow (a .swftx merge and third-party imports both emit it).
export function useProgress() {
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  useEffect(() => {
    const pending = on(EVENTS.importProgress, setProgress)
    return () => {
      pending.then(unlisten => unlisten()).catch(() => {})
    }
  }, [])

  const reset = () => setProgress({ done: 0, total: 0 })
  return { progress, reset }
}

export const pct = (done: number, total: number) =>
  total ? Math.round((done / total) * 100) : 0
