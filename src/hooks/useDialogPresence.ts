import { useEffect, useId } from 'react'
import { registerDialog, unregisterDialog } from '@/store'

/**
 * Tell the store this component is a modal surface for as long as it is
 * mounted. `isModalOpen()` is the union of these, so whatever renders a dialog
 * — a store-driven Modal, a compact Sheet, the palette, a prompt a component
 * keeps in its own state — counts the moment it is on screen, with nothing to
 * enumerate anywhere. The shared focus hook calls this, so every frame that
 * traps focus is registered by construction.
 */
export function useDialogPresence() {
  const id = useId()
  useEffect(() => {
    registerDialog(id)
    return () => unregisterDialog(id)
  }, [id])
}
