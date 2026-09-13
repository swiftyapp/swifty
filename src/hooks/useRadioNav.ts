import { useRef, type KeyboardEvent } from 'react'

// Arrow-key navigation for a single-select group (`role="radiogroup"`), shared
// by Segmented and RadioList. Per the ARIA pattern the arrows *select* as they
// move, so the group holds one tab stop and selection follows focus.
export function useRadioNav<T>(values: T[], value: T, onChange: (next: T) => void) {
  const ref = useRef<HTMLDivElement>(null)

  const move = (step: number) => {
    if (values.length === 0) return
    const buttons = Array.from(ref.current?.querySelectorAll('button') ?? [])
    // From the selection — or, with nothing selected (an unset group), from
    // the button under focus, so the first arrow moves on rather than choosing
    // the one already in hand.
    const selected = values.indexOf(value)
    const focused = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const from = selected >= 0 ? selected : focused
    const next = (from + step + values.length) % values.length
    onChange(values[next])
    // Selection follows focus, so pull focus along with it.
    buttons[next]?.focus()
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
