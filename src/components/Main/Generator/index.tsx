import { useEffect } from 'react'
import { useStore, openGenerator, closeGenerator } from '@/store'
import Dialog from './Dialog'

const isGenerateKey = (event: KeyboardEvent) =>
  (event.metaKey || event.ctrlKey) &&
  !event.altKey &&
  event.key.toLowerCase() === 'g'

// Mounted inside the unlocked shell, so ⌘G is only live once the vault is open.
// The dialog itself is store-driven: the login form opens it with a callback to
// fill its password field, ⌘G opens it standalone.
export default function Generator() {
  const generator = useStore(state => state.generator)

  // Re-pressing ⌘G while the dialog is up must not drop the callback it was
  // opened with, so an open dialog swallows the shortcut.
  const open = generator.open
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isGenerateKey(event)) return
      event.preventDefault()
      if (!open) openGenerator()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null
  return <Dialog apply={generator.apply} onClose={closeGenerator} />
}
