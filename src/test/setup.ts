import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// jsdom implements no layout, so it ships no scrollIntoView.
Element.prototype.scrollIntoView = vi.fn()

// The Rust backend is built in parallel; mock the whole command/event layer so
// screens render without a live backend. Individual tests override as needed.
vi.mock('@/lib/commands', () => ({
  isInitialized: vi.fn().mockResolvedValue(true),
  setup: vi.fn().mockResolvedValue(undefined),
  unlock: vi.fn().mockResolvedValue({ entries: [], syncConfigured: false }),
  lock: vi.fn().mockResolvedValue(undefined),
  unlockBiometric: vi.fn().mockResolvedValue({ entries: [], syncConfigured: false }),
  isBiometricAvailable: vi.fn().mockResolvedValue(false),
  enableBiometric: vi.fn().mockResolvedValue(undefined),
  disableBiometric: vi.fn().mockResolvedValue(undefined),
  changeMasterPassword: vi.fn().mockResolvedValue(undefined),
  readVault: vi.fn().mockResolvedValue([]),
  revealEntry: vi.fn().mockImplementation((id: string) =>
    Promise.resolve({ id, type: 'login', title: '' })
  ),
  saveEntry: vi.fn().mockImplementation((entry: { id: string; type: string; title: string }) =>
    Promise.resolve({ id: entry.id, type: entry.type, title: entry.title, tags: [], urlHost: '' })
  ),
  deleteEntry: vi.fn().mockResolvedValue(undefined),
  pickBackup: vi.fn().mockResolvedValue(null),
  importBackup: vi.fn().mockResolvedValue({ entries: [], syncConfigured: false }),
  importSwftx: vi.fn().mockResolvedValue(0),
  exportVault: vi.fn().mockResolvedValue(null),
  generatePassword: vi.fn().mockResolvedValue('Generated123!'),
  generateOtp: vi.fn().mockResolvedValue({ code: '123456', time: 30 }),
  verifyOtp: vi.fn().mockResolvedValue(true),
  getAudit: vi.fn().mockResolvedValue({}),
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
  syncConnect: vi.fn().mockResolvedValue(undefined),
  syncDisconnect: vi.fn().mockResolvedValue(undefined),
  syncNow: vi.fn().mockResolvedValue(undefined),
  syncImport: vi.fn().mockResolvedValue(undefined),
  syncStatus: vi.fn().mockResolvedValue({ configured: false }),
  // Pure helper (not a command); mirror the real projection so tests and the
  // dead sync path can use it against the mocked module.
  toEntryMeta: (entry: { id: string; type: string; title: string; tags?: string[] }) => ({
    id: entry.id,
    type: entry.type,
    title: entry.title,
    tags: entry.tags ?? [],
    urlHost: ''
  })
}))

vi.mock('@/lib/events', async orig => ({
  ...(await orig<typeof import('@/lib/events')>()),
  on: vi.fn().mockResolvedValue(() => {})
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
