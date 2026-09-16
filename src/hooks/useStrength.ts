import { useEffect, useState } from 'react'
import { evaluate, type Strength } from '@/services/strength'

// zxcvbn scoring is heavy (tens–hundreds of ms with the loaded dictionaries) and
// the dictionaries themselves arrive in a lazy chunk. Running it inline in render
// blocks the paint — the entry detail stalls when you select a login, and the
// setup field stutters while typing. Defer it to a post-paint macrotask (which
// also debounces rapid changes): the UI paints immediately and the score lands a
// moment later. Returns null until the first evaluation resolves (and whenever
// the password is empty).
export function useStrength(password: string): Strength | null {
  const [strength, setStrength] = useState<Strength | null>(null)

  useEffect(() => {
    if (!password) {
      setStrength(null)
      return
    }
    // `evaluate` is async now, so a result can land after the password moved on;
    // the flag drops anything the cleanup has already disowned. A load that
    // fails leaves the meter empty — the field still works without it, and the
    // next keystroke asks again.
    let alive = true
    const id = setTimeout(() => {
      evaluate(password)
        .then(result => {
          if (alive) setStrength(result)
        })
        .catch(() => {
          if (alive) setStrength(null)
        })
    }, 0)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [password])

  return strength
}
