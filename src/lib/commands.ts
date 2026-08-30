import { invoke } from '@tauri-apps/api/core'

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

export interface UnlockResult {
  vault: VaultData
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
  isShort: boolean
  isWeak: boolean
  isOld: boolean
  isRepeating: boolean
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

export const changeMasterPassword = (
  current: string,
  next: string
): Promise<void> => invoke('change_master_password', { current, new: next })

// ---------------------------------------------------------------------------
// Vault
// ---------------------------------------------------------------------------

export const readVault = (): Promise<VaultData> => invoke('read_vault')

export const saveVault = (entries: Entry[]): Promise<VaultData> =>
  invoke('save_vault', { entries })

export const pickBackup = (): Promise<string | null> => invoke('pick_backup')

export const importBackup = (
  path: string,
  password: string
): Promise<UnlockResult> => invoke('import_backup', { path, password })

export const exportVault = (): Promise<string | null> => invoke('export_vault')

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

export const getAudit = (): Promise<Audit> => invoke('get_audit')

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
