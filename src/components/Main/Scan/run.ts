import { scanImage, type EntryType } from '@/lib/commands'
import type { ScanError } from '@/store/uiSlice'
import {
  useStore,
  startEntry,
  setPrefill,
  scanStarted,
  scanFinished
} from '@/store'
import { cleanFields } from './fields'

// Which kind the detail pane is editing right now, if any — a new entry's
// chosen kind, or the kind of the entry being edited.
const editingKind = (): EntryType | null => {
  const { new: creating, edit, current } = useStore.getState().entries
  if (creating) return creating
  return edit ? (current?.type ?? null) : null
}

// The backend's failures, classified for the copy. An invoke rejects with the
// serialized error — a string here — but a thrown Error is handled too so a
// broken IPC still lands as a message rather than as an unhandled rejection.
const reason = (error: unknown): ScanError => {
  const message = typeof error === 'string' ? error : String((error as Error)?.message ?? error)
  if (message.includes('nothing recognized')) return 'unreadable'
  if (message.includes('not available on this platform')) return 'unsupported'
  return 'failed'
}

/**
 * Read one image and land its fields in an editor.
 *
 * The same path for a drop and for a file picked from the dialog. A scan of the
 * kind already open fills that form in place — a second photo of the same
 * passport should not open a second draft — and anything else starts a new
 * entry of the kind that was recognized. Both go through `entries.prefill`,
 * which `useDraft` is the only reader of.
 *
 * Never throws: the outcome is the status in the store.
 */
export const runScan = async (path: string): Promise<void> => {
  scanStarted()
  try {
    const result = await scanImage(path)
    const fields = cleanFields(result.fields)
    if (editingKind() === result.kind) setPrefill(fields)
    else startEntry(result.kind, fields)
    scanFinished()
  } catch (error) {
    scanFinished(reason(error))
  }
}
