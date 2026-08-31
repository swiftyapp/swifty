import { useEffect, useState } from 'react'
import { evaluate, type Strength } from '@/services/strength'

// zxcvbn scoring is synchronous and heavy (tens–hundreds of ms with the loaded
// dictionaries). Running it inline in render blocks the paint — the entry detail
// stalls when you select a login, and the setup field stutters while typing.
// Defer it to a post-paint macrotask (which also debounces rapid changes): the UI
// paints immediately and the score lands a moment later. Returns null until the
// first evaluation resolves (and whenever the password is empty).
export function useStrength(password: string): Strength | null {
  const [strength, setStrength] = useState<Strength | null>(null)

  useEffect(() => {
    if (!password) {
      setStrength(null)
      return
    }
    const id = setTimeout(() => setStrength(evaluate(password)), 0)
    return () => clearTimeout(id)
  }, [password])

  return strength
}
