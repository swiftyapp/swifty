import { useStore, closeGenerator } from '@/store'
import Dialog from './Dialog'

// Store-driven generator dialog: the login form opens it with a callback to
// fill its password field; the global ⌘G binding (Main/useShortcuts.ts) opens
// it standalone.
export default function Generator() {
  const generator = useStore(state => state.generator)

  if (!generator.open) return null
  return <Dialog apply={generator.apply} onClose={closeGenerator} />
}
