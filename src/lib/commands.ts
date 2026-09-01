import { invoke } from '@tauri-apps/api/core'
import { cardBrandOf } from '@/utils/cardBrand'

/**
 * Frozen command contract for the Swifty backend.
 * Every function is a thin, typed wrapper over a Rust `#[tauri::command]`.
 * Crypto and the master key live entirely in Rust: `unlock` returns decrypted
 * data for display and mutations send plaintext back to be re-encrypted.
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type EntryType = 'login' | 'note' | 'card'

interface BaseEntry {
  id: string
  type: EntryType
  title: string
  tags?: string[]
  createdAt?: string
  updatedAt?: string
  // snake_case aliases kept for backward compatibility with legacy vaults
  created_at?: string
  updated_at?: string
}

export interface LoginEntry extends BaseEntry {
  type: 'login'
  website: string
  username: string
  password: string
  email: string
  note: string
  otp: string // base32 TOTP secret
  password_updated_at?: string
}

export interface NoteEntry extends BaseEntry {
  type: 'note'
  note: string
}

export interface CardEntry extends BaseEntry {
  type: 'card'
  number: string
  month: string
  year: string
  cvc: string
  pin: string
  name: string
}

export type Entry = LoginEntry | NoteEntry | CardEntry

export interface VaultData {
  entries: Entry[]
}

// Non-secret entry metadata for the list. Secrets live in the encrypted store
// and arrive only via revealEntry, one entry at a time.
export interface EntryMeta {
  id: string
  type: EntryType
  title: string
  tags: string[]
  urlHost: string
  // Card network slug ("visa", …) derived from the number at save time;
  // absent for non-cards and unrecognized numbers.
  cardBrand?: string
  createdAt?: string
  updatedAt?: string
}

// Project a full entry down to its list metadata.
export const toEntryMeta = (entry: Entry): EntryMeta => ({
  id: entry.id,
  type: entry.type,
  title: entry.title,
  tags: entry.tags ?? [],
  urlHost: entry.type === 'login' ? hostOf(entry.website) : '',
  cardBrand: entry.type === 'card' ? cardBrandOf(entry.number) : undefined,
  createdAt: entry.createdAt ?? entry.created_at,
  updatedAt: entry.updatedAt ?? entry.updated_at
})

const hostOf = (website: string): string =>
  website
    .trim()
    .replace(/^https?:\/\//, '')
    .split('/')[0]

export interface UnlockResult {
  entries: EntryMeta[]
  syncConfigured: boolean
}

export interface GeneratorOptions {
  length: number
  numbers: boolean
  symbols: boolean
  uppercase: boolean
  lowercase?: boolean
  exclude?: string
  excludeSimilarCharacters?: boolean
  strict?: boolean
}

export interface OtpResult {
  code: string
  time: number // seconds left in the current 30s window
}

export interface AuditItem {
  score: number // zxcvbn strength, 0 (weakest) to 4 (strongest)
  isWeak: boolean
  isRepeating: boolean
  breached: boolean // exposed in a known breach (only when the breach check is enabled)
}

// Keyed by entry id; only entries that have a password are included.
export type Audit = Record<string, AuditItem>

export interface SyncStatus {
  configured: boolean
}

// ---------------------------------------------------------------------------
// Auth & setup
// ---------------------------------------------------------------------------

export const isInitialized = (): Promise<boolean> => invoke('is_initialized')

export const setup = (password: string): Promise<void> =>
  invoke('setup', { password })

export const unlock = (password: string): Promise<UnlockResult> =>
  invoke('unlock', { password })

export const lock = (): Promise<void> => invoke('lock')

export const unlockBiometric = (): Promise<UnlockResult> =>
  invoke('unlock_biometric')

export const isBiometricAvailable = (): Promise<boolean> =>
  invoke('is_biometric_available')

// How the enrolled vault key is gated. `protected` is OS-enforced (the macOS
// data-protection keychain releases the key only to Touch ID); `prompt` is
// app-enforced (we run the biometric check, then read a plain credential-store
// item). Decided once at enrollment and recorded, so the copy can be honest.
export type BiometricMode = 'protected' | 'prompt'

export interface BiometricStatus {
  enabled: boolean
  mode: BiometricMode | null
}

export const biometricStatus = (): Promise<BiometricStatus> =>
  invoke('biometric_status')

// Opt in/out of biometric unlock. `enable` stores the current session key in the
// OS secure store (biometry-gated) and resolves with the mode enrollment settled
// on; `disable` deletes it. Requires an unlocked vault.
export const enableBiometric = (): Promise<BiometricMode> =>
  invoke('enable_biometric')

export const disableBiometric = (): Promise<void> => invoke('disable_biometric')

export const changeMasterPassword = (
  current: string,
  next: string
): Promise<void> => invoke('change_master_password', { current, new: next })

// ---------------------------------------------------------------------------
// Vault
// ---------------------------------------------------------------------------

export const readVault = (): Promise<EntryMeta[]> => invoke('read_vault')

// Decrypt one entry's secret fields on demand (view/edit).
export const revealEntry = (id: string): Promise<Entry> =>
  invoke('reveal_entry', { id })

// Persist one entry (upsert a single row); returns its refreshed metadata.
export const saveEntry = (entry: Entry): Promise<EntryMeta> =>
  invoke('save_entry', { entry })

// Tombstone one entry.
export const deleteEntry = (id: string): Promise<void> =>
  invoke('delete_entry', { id })

export const pickBackup = (): Promise<string | null> => invoke('pick_backup')

export const importBackup = (
  path: string,
  password: string
): Promise<UnlockResult> => invoke('import_backup', { path, password })

// Merge a `.swftx` file (encrypted under its own `password`) into the currently
// unlocked vault. Runs off the UI thread and emits `import:progress`; resolves
// to the number of imported entries.
export const importSwftx = (
  path: string,
  password: string
): Promise<number> => invoke('import_swftx', { path, password })

// Export a portable `.swftx` backup, encrypted under the master `password` so it
// can be restored via import_backup on any install. The password must match the
// unlocked vault.
export const exportVault = (password: string): Promise<string | null> =>
  invoke('export_vault', { password })

// --- Third-party import/export ---

// Explicit format names understood by the backend (`import_entries`); 'auto'
// detects by extension/content.
export type ImportFormat =
  | 'auto'
  | 'bitwarden'
  | 'csv'
  | 'chrome'
  | 'lastpass'
  | 'keepass'

export type ExportFormat = 'bitwarden' | 'csv'

export interface RowError {
  row: number
  message: string
}

export interface ImportReport {
  total: number // parsed entries (would-be import on a dry run)
  imported: number // entries written (0 on a dry run)
  skipped: number // rows that failed to parse
  dryRun: boolean
  errors: RowError[]
}

export const pickImportFile = (): Promise<string | null> =>
  invoke('pick_import_file')

export const importEntries = (
  path: string,
  format: ImportFormat,
  dryRun: boolean
): Promise<ImportReport> =>
  invoke('import_entries', { path, format, dryRun })

export const exportEntries = (
  format: ExportFormat,
  path?: string
): Promise<string | null> =>
  invoke('export_entries', { path: path ?? null, format })

// ---------------------------------------------------------------------------
// Generator & OTP
// ---------------------------------------------------------------------------

export const generatePassword = (options: GeneratorOptions): Promise<string> =>
  invoke('generate_password', { options })

export const generateOtp = (secret: string): Promise<OtpResult> =>
  invoke('generate_otp', { secret })

export const verifyOtp = (secret: string, token: string): Promise<boolean> =>
  invoke('verify_otp', { secret, token })

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export const getAudit = (checkBreaches: boolean): Promise<Audit> =>
  invoke('get_audit', { checkBreaches })

// ---------------------------------------------------------------------------
// Favicons
// ---------------------------------------------------------------------------

// The site's favicon as a data: URI, or null when it has none. The backend
// fetches straight from the entry's own host (never a third-party favicon
// service) and caches on disk, so repeat calls are a file read.
export const fetchFavicon = (host: string): Promise<string | null> =>
  invoke('fetch_favicon', { host })

// ---------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------

export const copyToClipboard = (
  value: string,
  clearAfterMs?: number
): Promise<void> => invoke('copy_to_clipboard', { value, clearAfterMs })

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export const syncConnect = (): Promise<void> => invoke('sync_connect')

export const syncDisconnect = (): Promise<void> => invoke('sync_disconnect')

export const syncNow = (): Promise<void> => invoke('sync_now')

export const syncImport = (): Promise<void> => invoke('sync_import')

export const syncStatus = (): Promise<SyncStatus> => invoke('sync_status')
