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

export type EntryType = 'login' | 'note' | 'card' | 'identity' | 'ssh'

// One free-form field on an entry: a label the user wrote and its value.
export interface ExtraField {
  label: string
  value: string
}

interface BaseEntry {
  id: string
  type: EntryType
  title: string
  tags?: string[]
  // Free-form label/value pairs, in the user's order. Any kind may carry them;
  // absent when there are none, so an entry without any is unchanged.
  extra?: ExtraField[]
  createdAt?: string
  updatedAt?: string
  // snake_case aliases kept for backward compatibility with legacy vaults
  created_at?: string
  updated_at?: string
}

// A WebAuthn credential held by a login entry. Only P-256 ECDSA is supported,
// so there is no algorithm field. credentialId/userHandle/privateKey are
// base64url and are carried verbatim — never re-encoded. privateKey is a secret
// and only ever arrives inside a revealed entry.
export interface Passkey {
  credentialId: string
  rpId: string
  rpName?: string
  userHandle: string
  userName: string
  userDisplayName: string
  privateKey: string // PKCS#8 DER, base64url
  counter: number
  createdAt?: string // RFC3339
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
  // Absent on entries with no passkeys, so a pre-passkey vault is unchanged.
  passkeys?: Passkey[]
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
  note: string
}

// An ID document. `number` (the document number) and `personal_number` are the
// secrets; `name` is the holder's full name, kept whole rather than split. The
// three dates are ISO `YYYY-MM-DD` — the display pattern is a preference, never
// what is stored.
export interface IdentityEntry extends BaseEntry {
  type: 'identity'
  /** One of `passport`, `id_card`, `driver_license`, `residence_permit`, `other`. */
  doc_type: string
  name: string
  number: string
  /** Issuing country, ISO 3166-1 alpha-3 by preference but free text. */
  country: string
  nationality: string
  birth_date: string
  sex: string
  issue_date: string
  expiry_date: string
  authority: string
  personal_number: string
  note: string
}

// An SSH keypair. ed25519 only for now, so there is no algorithm field: the
// public line names it. `fingerprint` is derived from the key at generation or
// paste time and stored alongside, so the detail view can show it without
// parsing a PEM block. `passphrase` is what the key was protected with
// elsewhere — the app never encrypts the private key itself.
export interface SshEntry extends BaseEntry {
  type: 'ssh'
  privateKey: string // OpenSSH PEM
  publicKey: string // `ssh-ed25519 AAAA… comment`
  fingerprint: string // `SHA256:…`
  passphrase: string
  note: string
}

export type Entry = LoginEntry | NoteEntry | CardEntry | IdentityEntry | SshEntry

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
  // Starred by the user. Metadata rather than an entry field, so it is toggled
  // through setFavorite and never travels with the secrets.
  favorite: boolean
  // Whether the entry holds at least one passkey, derived from the payload at
  // save time so the list can mark the row without revealing anything. The
  // passkeys themselves only ever arrive via revealEntry.
  hasPasskey?: boolean
  createdAt?: string
  updatedAt?: string
  // Present only on the tombstones listDeleted returns.
  deletedAt?: string
}

// Project a full entry down to its list metadata. The star is not part of an
// entry, so it can only be reported as unset here; the backend's own projection
// is what carries the stored value.
export const toEntryMeta = (entry: Entry): EntryMeta => ({
  id: entry.id,
  type: entry.type,
  title: entry.title,
  tags: entry.tags ?? [],
  urlHost: entry.type === 'login' ? loginHost(entry) : '',
  cardBrand: entry.type === 'card' ? cardBrandOf(entry.number) : undefined,
  favorite: false,
  hasPasskey: entry.type === 'login' && (entry.passkeys?.length ?? 0) > 0,
  createdAt: entry.createdAt ?? entry.created_at,
  updatedAt: entry.updatedAt ?? entry.updated_at
})

// The site a login is shown under: its own website, or — for a passkey-only
// login, which routinely has no website — the first passkey's relying-party id,
// since that is the site the credential is bound to. Mirrors
// `store::migrate::derived_url_host` in Rust; keep the two in sync.
const loginHost = (entry: LoginEntry): string =>
  hostOf(entry.website) || (entry.passkeys?.[0]?.rpId ?? '')

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

// A generated ed25519 keypair, keyed like the `ssh` draft so it can be handed
// to `startEntry` as a prefill without a translation step — which is why it is
// an alias rather than an interface: only the former gets the implicit index
// signature that `Record<string, string>` wants.
export type SshKeyPair = {
  privateKey: string
  publicKey: string
  fingerprint: string
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

// The Trash: tombstoned entries' metadata, newest deletion first.
export const listDeleted = (): Promise<EntryMeta[]> => invoke('list_deleted')

// Un-tombstone one entry; returns its refreshed metadata.
export const restoreEntry = (id: string): Promise<EntryMeta> =>
  invoke('restore_entry', { id })

// Discard a tombstoned entry's contents for good.
export const purgeEntry = (id: string): Promise<void> =>
  invoke('purge_entry', { id })

// Star or unstar one entry; returns its refreshed metadata. A metadata-only
// write — the payload is never unsealed, so it costs no reveal.
export const setFavorite = (id: string, favorite: boolean): Promise<EntryMeta> =>
  invoke('set_favorite', { id, favorite })

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
  | 'cxf'
  | 'csv'
  | 'chrome'
  | 'lastpass'
  | 'keepass'

export type ExportFormat = 'bitwarden' | 'cxf' | 'csv'

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
// Scanning
// ---------------------------------------------------------------------------

// What the OS text recognizer read out of one image: the kind of secret it is,
// and its fields keyed exactly like that kind's draft.
export interface ScanResult {
  kind: 'card' | 'identity'
  fields: Record<string, string>
}

/**
 * Recognize a card or an identity document in the image at `path`.
 *
 * The path is the one the user already has (a drop, or the file dialog) — the
 * image is read where it lies and never copied. Rejects with "nothing
 * recognized" when the text is there but says neither.
 */
export const scanImage = (path: string): Promise<ScanResult> =>
  invoke('scan_image', { path })

// Whether this platform has a text recognizer at all. False on Linux and on a
// Windows without an OCR language pack, where the UI offers no scanning.
export const scanSupported = (): Promise<boolean> => invoke('scan_supported')

// ---------------------------------------------------------------------------
// Generator & OTP
// ---------------------------------------------------------------------------

export const generatePassword = (options: GeneratorOptions): Promise<string> =>
  invoke('generate_password', { options })

// A new unencrypted ed25519 keypair. `comment` is the label on the public line.
export const generateSshKey = (comment?: string): Promise<SshKeyPair> =>
  invoke('generate_ssh_key', { comment: comment || null })

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

export const setAutolockTimeout = (secs: number): Promise<void> =>
  invoke('set_autolock_timeout', { secs })

export const syncConnect = (): Promise<void> => invoke('sync_connect')

export const syncDisconnect = (): Promise<void> => invoke('sync_disconnect')

export const syncNow = (): Promise<void> => invoke('sync_now')

export const syncImport = (): Promise<void> => invoke('sync_import')

export const syncStatus = (): Promise<SyncStatus> => invoke('sync_status')

// ---------------------------------------------------------------------------
// Locale
// ---------------------------------------------------------------------------

/**
 * The OS locale, already narrowed to a catalog the app ships. Read from the
 * system rather than `navigator.language`, which reports the webview engine's
 * configuration and disagrees with the OS on some Linux and Windows setups.
 */
export const osLocale = (): Promise<string> => invoke('os_locale')
