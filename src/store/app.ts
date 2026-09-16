import { create } from 'zustand'
import type { UnlockResult } from '@/api/types'
import { appStatus, type AppStatus } from '@/api/app'
import { lock } from '@/api/auth'
import type { SetupDriveFile } from '@/api/setup'
import { syncNow, type SyncStatus } from '@/api/sync'
import { checkForUpdate } from '@/api/autoUpdate'
import { resetFavicons } from '@/hooks/useFavicon'
import { setEntries, resetVault, runAudit } from './vault'
import { resetUi } from './ui'

/**
 * State that lives as long as the app does, across locks: which flow is on
 * screen and the lock screen's gate, the backend's sync and first-run Drive
 * status as it reports them, and a staged update.
 */

export type FlowName = 'setup' | 'auth' | 'main'

export type UpdateCheckStatus = 'checking' | 'uptodate' | 'error' | null

/**
 * `pending` — consent is out with the browser
 * `found`   — the probe came back with a pack to restore
 * `empty`   — the probe came back with nothing; the account is usable, just bare
 * `error`   — the connect or the probe failed
 */
export type SetupDriveStatus = 'idle' | 'pending' | 'found' | 'empty' | 'error'

export interface AppState {
  flow: FlowName
  /**
   * The launch probe's last answer, in one place. It was eight `app_status`
   * calls racing each other — one per screen that wanted a leaf of it — so
   * every screen reads this instead and re-renders when it is refreshed. The
   * lock screen's gate (`biometric.available`, `biometric.type`) is read off it
   * rather than copied out at each flow change.
   *
   * Null until the boot probe lands (`boot.ts`), and on a host where that call
   * failed outright; every reader treats that as "nothing known yet".
   */
  status: AppStatus | null
  /**
   * The backend's sync status, verbatim. It owns every flow — it opens the
   * browser, hears back from it, runs the sync — so it is the one that can say;
   * every change arrives whole as `sync:status` and is stored as-is, and the
   * launch probe carries the same snapshot to start from (`status.sync`).
   *
   * The one place "does this vault sync" is read from. It used to be two — a
   * copy on `status` that only the probe refreshed, and this — so connecting
   * Drive in Settings left the footer on the same screen saying the vault was
   * local until the next lock.
   */
  sync: SyncStatus
  /**
   * The first run's Drive probe, which has no vault behind it yet — so it
   * cannot live in `sync`, whose `enabled` means "this vault syncs".
   */
  setupDrive: { status: SetupDriveStatus; file: SetupDriveFile | null; error: string | null }
  update: {
    // Version + release notes of a staged update awaiting restart (null = none).
    readyVersion: string | null
    readyNotes: string | null
    // Transient status of a manual update check (null = idle).
    status: UpdateCheckStatus
  }
}

const DRIVE_IDLE = { status: 'idle' as SetupDriveStatus, file: null, error: null }

export const initialApp: AppState = {
  // The auth screen is the default; setup is reached explicitly via `flowSetup`
  // once the probe says there is nothing on disk. With `status` null nothing
  // biometric is drawn before the probe answers.
  flow: 'auth',
  status: null,
  sync: { configured: false, pending: false, inProgress: false, error: null, lastSyncedAt: null },
  setupDrive: DRIVE_IDLE,
  update: { readyVersion: null, readyNotes: null, status: null }
}

export const useApp = create<AppState>()(() => initialApp)

// --- launch probe -----------------------------------------------------------------

/**
 * Take the boot probe's answer wholesale (see `boot.ts`). `sync` is lifted out
 * of it into its own slot rather than read off `status`: the probe is only one
 * of the two things that report sync, and the events that report the rest write
 * here too.
 */
export const setApp = (status: AppStatus) => useApp.setState({ status, sync: status.sync })

/**
 * Whether this platform has a text recognizer at all — a build-time fact about
 * the OS, so it is read off the probe rather than copied into the session's own
 * state and re-asked on every unlock.
 */
export const useScanSupported = () => useApp(state => state.status?.scanSupported ?? false)

/**
 * Ask again, after something that can change the answer: an unlock, a lock, an
 * enrollment. Resolves with what it stored — or null, keeping the last known
 * answer, if the call failed — and never rejects, so no caller has to guard it.
 */
export const refreshApp = (): Promise<AppStatus | null> =>
  appStatus()
    .then(status => {
      setApp(status)
      return status
    })
    .catch(() => null)

// --- flow -----------------------------------------------------------------------

export const flowSetup = () => useApp.setState({ flow: 'setup' })
export const flowAuth = () => useApp.setState({ flow: 'auth' })
export const flowMain = () => useApp.setState({ flow: 'main' })

// The lock screen reads its gate off `status`, so a lock re-runs the probe
// first: whether a key is enrolled can have changed since the last one. Asked
// rather than assumed — hardcoding `false` here is how the Touch ID button used
// to vanish on every in-session lock.
export const showLockScreen = () => refreshApp().then(() => flowAuth())

// Everything the unlocked session put in the stores. A lock has to drop all of
// it — it outlives the session otherwise, and the next unlock (of this or any
// other vault) opens onto the previous one's rows. Session-shaped state (flow,
// sync, update, prefs, locale) is deliberately kept.
//
// The favicon cache goes with them: it is keyed by hostname and holds the icons
// of the rows that were on screen, so leaving it would carry one vault's sites
// into the next unlock — of this vault or of another workspace.
export const clearSession = () => {
  resetVault()
  resetUi()
  resetFavicons()
  cancelScheduledSync()
}

// Manual lock, from anywhere (top chrome, Settings, palette). Nothing to do
// here but ask: the backend emits `vault:locked` for every lock there is, and
// the single reaction to it (events.ts) drops the session and shows the lock
// screen — for this, for the autolock, for the tray and for a workspace switch.
export const lockVault = () => lock().catch(() => {})

export const enterMain = async (result: UnlockResult) => {
  setEntries(result.entries)
  flowMain()
  // The unlock result carries whether this vault syncs; everything else about
  // sync arrives as `sync:status` once a flow or a run happens. No re-probe:
  // `initialized` and `scanSupported` cannot have changed, and this is the one
  // answer an unlock does change.
  useApp.setState(state => ({ sync: { ...state.sync, configured: result.syncConfigured } }))
  // One run on unlock: this device may have been off while another pushed,
  // and it may itself be holding writes a previous session never published.
  if (result.syncConfigured) syncNow().catch(() => {})
  void runAudit()
}

// --- sync -----------------------------------------------------------------------

/**
 * How long a write waits before it is published.
 *
 * A push is the whole vault, so firing one per keystroke-sized edit would send
 * the same snapshot over and over during a rename or a bulk import. The timer
 * resets on every write, so a burst costs exactly one push once it settles.
 * The debounce lives here rather than in the backend because the backend has
 * no write hook. A quit inside the window loses nothing: the next unlock runs
 * a sync anyway.
 */
const SYNC_DEBOUNCE_MS = 30_000

let syncTimer: ReturnType<typeof setTimeout> | undefined

// Drops a write waiting to be published. Called on lock: the backend has no key
// to push with any more, and the next unlock syncs anyway.
export const cancelScheduledSync = () => {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = undefined
}

export const scheduleSync = () => {
  if (!useApp.getState().sync.configured) return
  cancelScheduledSync()
  syncTimer = setTimeout(() => {
    syncTimer = undefined
    syncNow().catch(() => {})
  }, SYNC_DEBOUNCE_MS)
}

export const setSyncStatus = (sync: SyncStatus) => useApp.setState({ sync })

// --- first-run Drive probe ---------------------------------------------------------

export const setupDrivePending = () =>
  useApp.setState({ setupDrive: { status: 'pending', file: null, error: null } })
export const setupDriveProbed = (file: SetupDriveFile | null) =>
  useApp.setState({ setupDrive: { status: file ? 'found' : 'empty', file, error: null } })
export const setupDriveFailed = (error: string) =>
  useApp.setState({ setupDrive: { status: 'error', file: null, error } })
export const setupDriveReset = () => useApp.setState({ setupDrive: DRIVE_IDLE })

// --- updates ----------------------------------------------------------------------

// Records a staged update (drives the restart toast).
export const setUpdateReady = (version: string, notes: string | null) =>
  useApp.setState(state => ({
    update: { ...state.update, readyVersion: version, readyNotes: notes }
  }))

// Dismisses the restart toast; the staged update still applies on next launch.
export const dismissUpdate = () =>
  useApp.setState(state => ({ update: { ...state.update, readyVersion: null, readyNotes: null } }))

const setUpdateStatus = (status: UpdateCheckStatus) =>
  useApp.setState(state => ({ update: { ...state.update, status } }))

// On-demand check with visible feedback for every outcome.
export const runUpdateCheck = async () => {
  if (useApp.getState().update.status === 'checking') return
  setUpdateStatus('checking')

  const result = await checkForUpdate()
  if (result.kind === 'staged') {
    useApp.setState({
      update: { readyVersion: result.version, readyNotes: result.notes, status: null }
    })
    return
  }
  // Nothing to report on a build without an updater (mobile ships through the
  // App Store); the control that starts a check is hidden there anyway.
  if (result.kind === 'unsupported') {
    setUpdateStatus(null)
    return
  }

  const status = result.kind === 'uptodate' ? 'uptodate' : 'error'
  setUpdateStatus(status)
  setTimeout(
    () => {
      if (useApp.getState().update.status === status) setUpdateStatus(null)
    },
    status === 'uptodate' ? 4000 : 6000
  )
}
