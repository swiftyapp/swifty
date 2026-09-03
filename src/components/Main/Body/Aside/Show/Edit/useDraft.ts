import { useState, useEffect } from 'react'
import { setCurrentEntry, setNoEntry, saveEntry } from '@/store'
import { kindOf } from '@/kinds'
import { dialogOpen } from '@/utils/dialogOpen'
import type { EntryDraft } from '@/defaults/entries'
import type { Entry, EntryType } from '@/lib/commands'
import { t } from '@/i18n'

export interface Draft {
  model: EntryDraft
  set: (name: string, value: string | string[]) => void
  /** Something has been typed since the draft was loaded. */
  dirty: boolean
  /** Save has been attempted, so required fields may now complain. */
  attempted: boolean
  /** Cancel is armed: the next request discards. */
  confirmDiscard: boolean
  saveError: string | null
  save: () => void
  cancel: () => void
}

/**
 * One editing session: the draft, its dirty baseline, the two-press discard
 * guard, and the ⌘⏎ / Esc bindings. Mounted only while editing and keyed on the
 * entry, so every session starts from a fresh read of the vault.
 */
export function useDraft(type: EntryType, revealed: Entry | null): Draft {
  const kind = kindOf(type)
  const initial = (): EntryDraft => ({ ...kind.defaults })

  const [attempted, setAttempted] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [model, setModel] = useState<EntryDraft>(initial)
  // What the model looked like when it was loaded — the dirty baseline.
  const [pristine, setPristine] = useState<EntryDraft>(initial)

  // Secret fields arrive encrypted; swap in the decrypted values — once. The
  // reveal refetches when the entry's `updatedAt` moves (e.g. a sync merge
  // landing mid-edit), and adopting that refetch would silently replace
  // whatever the user has typed. The baseline is the state at open; a
  // concurrent change resolves through last-writer-wins on save.
  const [adopted, setAdopted] = useState(false)
  useEffect(() => {
    if (!revealed || adopted) return
    setAdopted(true)
    setModel({ ...revealed })
    setPristine({ ...revealed })
  }, [revealed, adopted])

  const dirty = JSON.stringify(model) !== JSON.stringify(pristine)

  const set = (name: string, value: string | string[]) => {
    setConfirmDiscard(false)
    setModel(current => ({
      ...current,
      [name]: value,
      ...(name === 'password' ? { password_updated_at: new Date().toISOString() } : {})
    }))
  }

  const close = () => {
    if (model.id) setCurrentEntry(model.id)
    else setNoEntry()
  }

  // Esc / Cancel. Unsaved edits arm an inline confirm on the Cancel button
  // instead of a blocking dialog; the next request discards.
  const cancel = () => {
    if (!dirty || confirmDiscard) {
      close()
      return
    }
    setConfirmDiscard(true)
  }

  const save = () => {
    if (!kind.isValid(model)) {
      setAttempted(true)
      return
    }
    setSaveError(null)
    // Never imply success on a failed write: surface the error, stay in edit.
    saveEntry(model).catch(() => setSaveError(t('Could not save. Please try again.')))
  }

  // Bound fresh every render: both handlers close over the current draft.
  //
  // Both keys stand down while a dialog is up. The editor opens dialogs of its
  // own (the generator, off the password row), and this listener is on
  // `document` — so it sees Escape on the way *down* to the dialog's own
  // handler. Without the guard, dismissing the generator would also end the
  // edit session, and ⌘⏎ inside it would save the draft behind it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (dialogOpen()) return
      if (event.key === 'Escape') return cancel()
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        save()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  return { model, set, dirty, attempted, confirmDiscard, saveError, save, cancel }
}
