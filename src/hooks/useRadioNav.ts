import { useRef, type KeyboardEvent } from 'react'

// Arrow-key navigation for a single-select group (`role="radiogroup"`), shared
// by Segmented and RadioList. Per the ARIA pattern the arrows *select* as they
// move, so the group holds one tab stop and selection follows focus.
export function useRadioNav<T>(values: T[], value: T, onChange: (next: T) => void) {
  const ref = useRef<HTMLDivElement>(null)

  const move = (step: number) => {
    if (values.length === 0) return
    const from = values.indexOf(value)
    const next = (from + step + values.length) % values.length
    onChange(values[next])
    // Selection follows focus, so pull focus along with it.
    ref.current?.querySelectorAll('button')[next]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        move(1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        move(-1)
        break
      default:
        return
    }
    event.preventDefault()
  }

  return { ref, onKeyDown }
}
