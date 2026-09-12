import { useStore, startEntry, closeAddPicker } from '@/store'
import { dialogOpen } from '@/utils/dialogOpen'
import { ingestDroppedEnvFile, type IngestedEnv } from '@/kinds/env/ingest'

/**
 * Open the env editor as a new draft with the file already in it — the same
 * `entries.prefill` road a scan takes, so `useDraft` seeds the body, the file
 * name and the proposed title as the initial model rather than as typing.
 */
export const openEnvDraft = ({ body, fileName, title }: IngestedEnv) => {
  closeAddPicker()
  startEntry('env', { body, fileName, title })
}

/** The exact idle surface that owned a drop, used as a lease across the read. */
const idleDropContext = (): boolean | null => {
  const { entries, ui } = useStore.getState()
  if (entries.new || entries.edit) return null
  if (dialogOpen() && !ui.addPicker) return null
  return ui.addPicker
}

/**
 * A `.env` dropped onto the idle window opens a filled-in editor: one drop,
 * one save. Idle means no editor is up — one that is has its own zone, and a
 * drop there is that draft's business, never a second one. The Add picker is
 * the exception among the dialogs: it is the moment the user is choosing what
 * to add, so a drop answers it and closes it. Every other dialog (Settings ›
 * Import has a zone of its own) keeps the drop.
 *
 * Images are the scanner's, so they are not even read. Anything else is read
 * and kept only if it is named or reads like an env file — a file that is
 * neither does nothing, as today.
 */
export const dropIdle = async (paths: string[]): Promise<void> => {
  const context = idleDropContext()
  if (context === null) return
  const [path] = paths
  if (!path) return
  const file = await ingestDroppedEnvFile(path).catch(() => null)
  // Reading crosses an async boundary: only the same still-idle surface may
  // consume its result. Opening/closing the picker also changes ownership.
  if (file && idleDropContext() === context) openEnvDraft(file)
}
