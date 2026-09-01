import { useEffect, useSyncExternalStore } from 'react'
import { fetchFavicon } from '@/lib/commands'

// Favicons for list rows: one backend call per host per session (the backend
// caches on disk), fanned out to every row showing that host. Returns the
// data: URI, or null while loading / after a miss — callers fall back to the
// type glyph either way.
const cache = new Map<string, string | null>()
const pending = new Set<string>()
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const lookup = (host: string) => {
  if (cache.has(host) || pending.has(host)) return
  pending.add(host)
  fetchFavicon(host)
    .catch(() => null)
    .then(uri => {
      cache.set(host, uri ?? null)
      pending.delete(host)
      listeners.forEach(listener => listener())
    })
}

export function useFavicon(host?: string): string | null {
  const icon = useSyncExternalStore(subscribe, () =>
    host ? (cache.get(host) ?? null) : null
  )
  useEffect(() => {
    if (host) lookup(host)
  }, [host])
  return icon
}

// Test seam: the cache is module-level so it outlives per-test stores.
export const resetFavicons = () => {
  cache.clear()
  pending.clear()
}
