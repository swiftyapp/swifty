import { useEffect, useRef, useState } from 'react'

// Ease-out cubic: fast off the mark, settling gently.
const ease = (t: number) => 1 - (1 - t) ** 3

/**
 * A number that follows `target`, but takes `ms` to get there — for a value
 * that draws something (the mascot's smile) and would otherwise snap between
 * two shapes when a prop changes. Starts at `target` on mount, so a first
 * render is never mid-flight.
 */
export function useTween(target: number, ms: number): number {
  const [value, setValue] = useState(target)
  const current = useRef(target)

  useEffect(() => {
    const from = current.current
    if (from === target) return
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const next = from + (target - from) * ease(t)
      current.current = next
      setValue(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, ms])

  return value
}
