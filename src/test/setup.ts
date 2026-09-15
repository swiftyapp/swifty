import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'
import { resetIpc } from './ipc'
import { setLayout } from './layout'
import { resetStores } from './utils'

// jsdom implements no layout, so it ships no scrollIntoView.
Element.prototype.scrollIntoView = vi.fn()

// Every suite starts on the wide shell — the one the desktop window and all the
// pre-existing tests assume — with pristine stores and preferences. A compact
// test calls `setLayout('compact')` itself.
setLayout('wide')
beforeEach(() => {
  setLayout('wide')
  localStorage.clear()
  resetStores()
})

// The Rust backend is built in parallel, so the one seam that reaches it is
// faked here and every command answers out of `./ipc`. A spec overrides the
// single call it is about with `mockCommand`.
vi.mock('@tauri-apps/api/core', async () => {
  const { invokeMock } = await import('./ipc')
  return { invoke: invokeMock }
})

beforeEach(resetIpc)

vi.mock('@/api/events', async orig => ({
  ...(await orig<typeof import('@/api/events')>()),
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

// The file dialog: nothing picked unless a test says otherwise.
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn().mockResolvedValue(null)
}))

// The app store imports the updater at module load.
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }))

// Components under test call useTranslation(); the singleton must be
// initialized once before any of them render.
const { i18nReady } = await import('@/i18n')
await i18nReady
