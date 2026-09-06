import { useEffect, type RefObject } from 'react'

/**
 * ⏎ confirms and Esc closes — but only for the card, and only while it is the
 * topmost dialog on screen.
 *
 * This is dialog behaviour, not generator behaviour, which is why it is not in
 * `useGeneratorDialog`: the phone draws the same generator as a tab root, and a
 * root has no dialog to be the topmost of (nor a keyboard to press ⏎ on).
 */
export function useDialogKeys(
  card: RefObject<HTMLDivElement | null>,
  confirm: () => void,
  onClose: () => void
) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Something nearer the key already handled it (a field's own Esc, the
      // palette's ⏎) — acting again would fire two things off one press.
      if (event.defaultPrevented) return
      // Only the topmost dialog answers: the generator can sit under a palette
      // opened over it, and ⏎ there belongs to the palette's command.
      const dialogs = document.querySelectorAll('[role="dialog"]')
      if (dialogs[dialogs.length - 1] !== card.current) return

      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (event.key === 'Enter') {
        event.preventDefault()
        confirm()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [card, confirm, onClose])
}
