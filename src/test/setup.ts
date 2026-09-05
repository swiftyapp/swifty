import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// jsdom implements no layout, so it ships no scrollIntoView.
Element.prototype.scrollIntoView = vi.fn()

// The Rust backend is built in parallel; mock the whole command/event layer so
// screens render without a live backend. Individual tests override as needed.
vi.mock('@/lib/commands', () => ({
  isInitialized: vi.fn().mockResolvedValue(true),
  osLocale: vi.fn().mockResolvedValue('en-US'),
  setup: vi.fn().mockResolvedValue(undefined),
  unlock: vi.fn().mockResolvedValue({ entries: [], syncConfigured: false }),
  lock: vi.fn().mockResolvedValue(undefined),
  unlockBiometric: vi.fn().mockResolvedValue({ entries: [], syncConfigured: false }),
  isBiometricAvailable: vi.fn().mockResolvedValue(false),
  biometricStatus: vi.fn().mockResolvedValue({ enabled: false, mode: null }),
  enableBiometric: vi.fn().mockResolvedValue('protected'),
  disableBiometric: vi.fn().mockResolvedValue(undefined),
  changeMasterPassword: vi.fn().mockResolvedValue(undefined),
  readVault: vi.fn().mockResolvedValue([]),
  revealEntry: vi.fn().mockImplementation((id: string) =>
    Promise.resolve({ id, type: 'login', title: '' })
  ),
  saveEntry: vi.fn().mockImplementation((entry: { id: string; type: string; title: string }) =>
    Promise.resolve({
      id: entry.id,
      type: entry.type,
      title: entry.title,
      tags: [],
      urlHost: '',
      favorite: false
    })
  ),
  deleteEntry: vi.fn().mockResolvedValue(undefined),
  listDeleted: vi.fn().mockResolvedValue([]),
  restoreEntry: vi.fn().mockImplementation((id: string) =>
    Promise.resolve({ id, type: 'login', title: '', tags: [], urlHost: '', favorite: false })
  ),
  purgeEntry: vi.fn().mockResolvedValue(undefined),
  setFavorite: vi.fn().mockImplementation((id: string, favorite: boolean) =>
    Promise.resolve({ id, type: 'login', title: '', tags: [], urlHost: '', favorite })
  ),
  pickBackup: vi.fn().mockResolvedValue(null),
  pickImportFile: vi.fn().mockResolvedValue(null),
  importEntries: vi
    .fn()
    .mockResolvedValue({ total: 0, imported: 0, skipped: 0, dryRun: true, errors: [] }),
  exportEntries: vi.fn().mockResolvedValue(null),
  setAutolockTimeout: vi.fn().mockResolvedValue(undefined),
  importBackup: vi.fn().mockResolvedValue({ entries: [], syncConfigured: false }),
  importSwftx: vi.fn().mockResolvedValue(0),
  exportVault: vi.fn().mockResolvedValue(null),
  generatePassword: vi.fn().mockResolvedValue('Generated123!'),
  generateSshKey: vi.fn().mockResolvedValue({
    privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nc2VjcmV0\n-----END OPENSSH PRIVATE KEY-----\n',
    publicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI',
    fingerprint: 'SHA256:GeneratedFingerprint'
  }),
  generateOtp: vi.fn().mockResolvedValue({ code: '123456', time: 30 }),
  verifyOtp: vi.fn().mockResolvedValue(true),
  getAudit: vi.fn().mockResolvedValue({}),
  fetchFavicon: vi.fn().mockResolvedValue(null),
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
  syncConnect: vi.fn().mockResolvedValue(undefined),
  syncDisconnect: vi.fn().mockResolvedValue(undefined),
  syncNow: vi.fn().mockResolvedValue(undefined),
  syncImport: vi.fn().mockResolvedValue(undefined),
  syncStatus: vi.fn().mockResolvedValue({ configured: false, pending: false }),
  // Off by default, so no suite sees a scan affordance it did not ask for.
  scanSupported: vi.fn().mockResolvedValue(false),
  scanImage: vi.fn().mockRejectedValue('nothing recognized'),
  // Pure helper (not a command); mirror the real projection so tests and the
  // dead sync path can use it against the mocked module.
  toEntryMeta: (entry: { id: string; type: string; title: string; tags?: string[] }) => ({
    id: entry.id,
    type: entry.type,
    title: entry.title,
    tags: entry.tags ?? [],
    urlHost: '',
    favorite: false
  })
}))

vi.mock('@/lib/events', async orig => ({
  ...(await orig<typeof import('@/lib/events')>()),
  on: vi.fn().mockResolvedValue(() => {})
}))

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn().mockResolvedValue('1.0.0')
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ setSize: vi.fn().mockResolvedValue(undefined) })
}))

vi.mock('@tauri-apps/api/dpi', () => ({
  LogicalSize: class {
    constructor(
      public width: number,
      public height: number
    ) {}
  }
}))

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined)
}))

// The file dialog: nothing picked unless a test says otherwise.
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn().mockResolvedValue(null)
}))

// Components under test call useTranslation(); the singleton must be
// initialized once before any of them render.
const { i18nReady } = await import('@/i18n')
await i18nReady
