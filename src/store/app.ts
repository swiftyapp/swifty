import { create } from 'zustand'
import {
  lock,
  isBiometricAvailable,
  biometryType,
  setAutolockTimeout,
  scanSupported,
  syncNow,
  type BiometryType,
  type SetupDriveFile,
  type UnlockResult
} from '@/lib/commands'
import { checkForUpdate } from '@/services/autoUpdate'
import { usePrefs } from './prefs'
import { setEntries, resetVault, runAudit } from './vault'
import { setScanSupported, resetUi } from './ui'

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

export interface SyncState {
  enabled: boolean
  inProgress: boolean
  success: boolean
  error: string | null
  /**
   * ISO time of the last run that actually succeeded, or null if none has in
   * this session. `success` alone cannot answer "has this vault synced yet" —
   * it starts optimistically true, so a freshly connected vault would claim to
   * be up to date before a single run.
   */
  lastSyncedAt: string | null
  /**
   * A consent flow is out with the browser. On mobile `sync_connect` returns
   * the moment Safari opens — the result arrives later as `sync:connected` or
   * `sync:error` — so the promise cannot be what the button waits on.
   */
  pending: boolean
}

export interface AppState {
  flow: FlowName
  /** Biometric unlock is enrolled *and* usable, so the lock screen offers it. */
  touchID: boolean
  /** Which gate it is, for the copy: the same iOS build runs on Face ID and Touch ID. */
  biometry: BiometryType
  sync: SyncState
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
  // No backend command exists to detect a pristine vault, so the auth screen is
  // the default; setup is reached explicitly via `flowSetup`. `touchID: false`
  // means nothing biometric is drawn before the probe answers.
  flow: 'auth',
  touchID: false,
  biometry: 'touch',
  sync: {
    enabled: false,
    inProgress: false,
    success: true,
    error: null,
    lastSyncedAt: null,
    pending: false
  },
  setupDrive: DRIVE_IDLE,
  update: { readyVersion: null, readyNotes: null, status: null }
}

export const useApp = create<AppState>()(() => initialApp)

const patchSync = (patch: Partial<SyncState>) =>
  useApp.setState(state => ({ sync: { ...state.sync, ...patch } }))

// --- flow -----------------------------------------------------------------------

export const flowSetup = () => useApp.setState({ flow: 'setup' })
export const flowMain = () => useApp.setState({ flow: 'main' })

// Omit `biometry` to keep the last known one: it is a property of the device,
// so only the callers already probing the backend have a fresh answer to hand.
export const flowAuth = (touchID: boolean, biometry?: BiometryType) =>
  useApp.setState(state => ({ flow: 'auth', touchID, biometry: biometry ?? state.biometry }))

// Whether the lock screen can offer a biometric gate, and which one. Asked
// rather than assumed — hardcoding `false` here is how the Touch ID button used
// to vanish on every in-session lock.
export const probeGate = () =>
  Promise.all([
    isBiometricAvailable().catch(() => false),
    biometryType().catch(() => 'touch' as const)
  ])

export const showLockScreen = () =>
  probeGate().then(([available, biometry]) => flowAuth(available, biometry))

// Everything the unlocked session put in the stores. A lock has to drop all of
// it — it outlives the session otherwise, and the next unlock (of this or any
// other vault) opens onto the previous one's rows. Session-shaped state (flow,
// sync, update, prefs, locale) is deliberately kept.
export const clearSession = () => {
  resetVault()
  resetUi()
  cancelScheduledSync()
}

// Manual lock, from anywhere (top chrome, Settings, palette). Autolock takes
// the same path via the vault:locked event (events.ts).
export const lockVault = () =>
  lock().finally(() => {
    clearSession()
    return showLockScreen()
  })

export const enterMain = async (result: UnlockResult) => {
  setEntries(result.entries)
  flowMain()
  // The backend resets to its built-in default on every launch; re-apply the
  // stored preference as soon as there is a session to protect.
  setAutolockTimeout(usePrefs.getState().autolockSecs).catch(() => {})
  syncInit(result.syncConfigured)
  // Asked once per session: whether the OS can read a card off a photo decides
  // whether any scan affordance is offered at all.
  scanSupported().then(setScanSupported).catch(() => {})
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
  if (!useApp.getState().sync.enabled) return
  cancelScheduledSync()
  syncTimer = setTimeout(() => {
    syncTimer = undefined
    syncNow().catch(() => {})
  }, SYNC_DEBOUNCE_MS)
}

export const syncInit = (enabled: boolean) => patchSync({ enabled })
export const syncPending = () => patchSync({ pending: true, error: null })
export const syncConnected = () =>
  patchSync({ enabled: true, success: true, error: null, pending: false })
export const syncFailed = (error: string) => patchSync({ pending: false, error })
// Disconnecting drops the timestamp with it: the next connection is a new
// pairing, and "synced 3m ago" from a previous one would be a lie about it.
export const syncDisconnected = () =>
  patchSync({ enabled: false, pending: false, lastSyncedAt: null })
export const syncStart = () => patchSync({ inProgress: true, success: true, error: null })
export const syncStop = (payload: { success: boolean; error?: string }) =>
  useApp.setState(state => ({
    sync: {
      ...state.sync,
      inProgress: false,
      success: payload.success,
      error: payload.error ?? null,
      // A failed run leaves the previous success standing: the vault is still
      // current as of whenever it last landed.
      lastSyncedAt: payload.success ? new Date().toISOString() : state.sync.lastSyncedAt
    }
  }))

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
