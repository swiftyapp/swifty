import { create } from 'zustand'
import { shareRevoke, type EntryType, type SshKeyPair } from '@/lib/commands'
import { loadArchive, setNoEntry, useVault, selectCurrent } from './vault'

/**
 * The surfaces open over the vault and how the list is narrowed. Everything
 * here is session data — a lock drops it with the rows (`clearSession`): a
 * share dialog's link is live credentials that must not stay on screen behind
 * whoever unlocks next, and a scan probe is re-asked per unlock.
 */

// `tags` is the vault by one tag (`filterTag`): every item carrying it, from
// across the vault, with the Tags tile lit. Entered through `showTag`.
export type View = 'items' | 'favorites' | 'health' | 'archive' | 'tags'

// The Settings sections, in nav order.
export type Section = 'sync' | 'security' | 'audit' | 'import' | 'language'

/** Why a scan produced no fields. The copy for each lives in `Scan/Status`. */
export type ScanError = 'unreadable' | 'unsupported' | 'failed'

// Receives the generated value when the user confirms. The login form supplies
// one to fill its password field; the standalone ⌘G flow leaves it null and the
// dialog just copies.
export type GeneratorApply = (value: string) => void

// The SSH counterpart: a key is three draft fields, not one string, so the ssh
// editor's Generate button takes the whole pair. Opening this way also picks
// the dialog's mode — there is nothing else to generate from that row.
export type SshApply = (pair: SshKeyPair) => void

export interface Generator {
  open: boolean
  apply: GeneratorApply | null
  ssh: SshApply | null
}

export interface UiState {
  view: View
  // `filterType: null` is "All Items". The type filter is a filter and nothing
  // else: it does not double as navigation or as the kind of a new entry.
  filterType: EntryType | null
  // What the Tags view shows. Only that view holds one — `showTag` sets it with
  // the view and `setView` clears it — and it composes with the kind filter.
  filterTag: string | null
  query: string
  palette: boolean
  settings: boolean
  settingsSection: Section
  addPicker: boolean
  generator: Generator
  /** The entry being shared, or null when the send dialog is closed. */
  sendFor: string | null
  receiveOpen: boolean
  /**
   * File ids of shares that were published after their dialog had moved on,
   * whose revoke has not yet succeeded. A seal that lands late is a live link
   * in the sender's Drive that no screen ever showed; it stays here until it
   * is taken back, and every share surface retries on the way in.
   */
  orphans: string[]
  // Image scanning: whether the platform can do it at all (asked once per
  // unlock — no affordance is shown when it cannot), and the current run.
  scanSupported: boolean
  scanBusy: boolean
  scanError: ScanError | null
}

const GENERATOR_CLOSED: Generator = { open: false, apply: null, ssh: null }

export const initialUi: UiState = {
  view: 'items',
  filterType: null,
  filterTag: null,
  query: '',
  palette: false,
  settings: false,
  settingsSection: 'sync',
  addPicker: false,
  generator: GENERATOR_CLOSED,
  sendFor: null,
  receiveOpen: false,
  orphans: [],
  scanSupported: false,
  scanBusy: false,
  scanError: null
}

export const useUi = create<UiState>()(() => initialUi)

// --- views and filters -----------------------------------------------------------

export const setView = (view: View) => {
  // A tag belongs to the Tags view alone, so moving between views drops it.
  useUi.setState({ view, filterTag: null })
  setNoEntry()
  // Tombstones are not part of the unlock payload, so the Archive reads them
  // when it is opened. Refetching on every visit is also what keeps it honest
  // after a sync merged a peer's deletes.
  if (view === 'archive') void loadArchive()
}

// The one way into the Tags view: the view and its tag change together, so
// there is never a frame of the Tags view showing the whole vault.
export const showTag = (tag: string) => {
  useUi.setState({ view: 'tags', filterTag: tag })
  setNoEntry()
}

export const setFilterQuery = (query: string) => useUi.setState({ query })

// A selection the new filter still shows is kept — narrowing to the kind you
// are already reading shouldn't close it. Only a selection the filter would
// hide is dropped, along with any in-progress new/edit.
const dropHidden = (hidden: (current: { type: EntryType; tags: string[] }) => boolean) => {
  const current = selectCurrent(useVault.getState())
  if (current && hidden(current)) setNoEntry()
}

export const setFilterType = (type: EntryType | null) => {
  useUi.setState({ filterType: type })
  if (type) dropHidden(current => current.type !== type)
}

export const setFilterTag = (tag: string | null) => {
  useUi.setState({ filterTag: tag })
  if (tag) dropHidden(current => !current.tags.includes(tag))
}

// --- overlays -----------------------------------------------------------------------

export const openPalette = () => useUi.setState({ palette: true })
export const closePalette = () => useUi.setState({ palette: false })

// Without a section the modal reopens where it was left, so a deep link from
// the palette is the only thing that moves it.
export const openSettings = (section?: Section) =>
  useUi.setState(state => ({
    palette: false,
    settings: true,
    settingsSection: section ?? state.settingsSection
  }))
export const closeSettings = () => useUi.setState({ settings: false })
export const setSettingsSection = (section: Section) => useUi.setState({ settingsSection: section })

export const openAddPicker = () => useUi.setState({ palette: false, addPicker: true })
export const closeAddPicker = () => useUi.setState({ addPicker: false })

export const openGenerator = (apply?: GeneratorApply) =>
  useUi.setState({ generator: { ...GENERATOR_CLOSED, open: true, apply: apply ?? null } })
export const openSshGenerator = (ssh: SshApply) =>
  useUi.setState({ generator: { ...GENERATOR_CLOSED, open: true, ssh } })
export const closeGenerator = () => useUi.setState({ generator: GENERATOR_CLOSED })

// --- sharing -----------------------------------------------------------------------

export const openSend = (entryId: string) => useUi.setState({ sendFor: entryId })
export const closeSend = () => useUi.setState({ sendFor: null })
export const openReceive = () => useUi.setState({ receiveOpen: true })
export const closeReceive = () => useUi.setState({ receiveOpen: false })

export const queueOrphan = (fileId: string) =>
  useUi.setState(state => ({
    orphans: state.orphans.includes(fileId) ? state.orphans : [...state.orphans, fileId]
  }))
export const dropOrphan = (fileId: string) =>
  useUi.setState(state => ({ orphans: state.orphans.filter(id => id !== fileId) }))

// Take back every orphaned share that can be taken back now. One failing does
// not stop the rest, and whatever still fails stays queued for the next
// surface that calls this.
export const revokeOrphans = async () => {
  await Promise.all(
    useUi.getState().orphans.map(fileId =>
      shareRevoke(fileId)
        .then(() => dropOrphan(fileId))
        .catch(() => {})
    )
  )
}

// --- scanning ---------------------------------------------------------------------

export const setScanSupported = (scanSupported: boolean) => useUi.setState({ scanSupported })
// A new run replaces the previous run's complaint: the user is answering it.
export const scanStarted = () => useUi.setState({ scanBusy: true, scanError: null })
export const scanFinished = (error?: ScanError | null) =>
  useUi.setState({ scanBusy: false, scanError: error ?? null })
export const dismissScan = () => useUi.setState({ scanError: null })

export const resetUi = () => useUi.setState(initialUi, true)
