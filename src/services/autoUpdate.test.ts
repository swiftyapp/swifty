import { describe, it, expect, beforeEach, vi } from 'vitest'
import { check } from '@tauri-apps/plugin-updater'
import { checkForUpdate } from './autoUpdate'

vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }))

const mockUpdate = (version: string, body?: string) => ({
  version,
  body,
  downloadAndInstall: vi.fn().mockResolvedValue(undefined)
})

beforeEach(() => vi.clearAllMocks())

describe('checkForUpdate', () => {
  it('stages a found update and returns its version and notes', async () => {
    const update = mockUpdate('1.2.0', 'Bug fixes')
    vi.mocked(check).mockResolvedValue(update as never)

    const result = await checkForUpdate()

    expect(update.downloadAndInstall).toHaveBeenCalledOnce()
    expect(result).toEqual({ kind: 'staged', version: '1.2.0', notes: 'Bug fixes' })
  })

  it('collapses blank release notes to null', async () => {
    vi.mocked(check).mockResolvedValue(mockUpdate('1.2.0', '   ') as never)
    expect(await checkForUpdate()).toEqual({ kind: 'staged', version: '1.2.0', notes: null })
  })

  it('reports up to date when no update is available', async () => {
    vi.mocked(check).mockResolvedValue(null)
    expect(await checkForUpdate()).toEqual({ kind: 'uptodate' })
  })

  it('maps a thrown error to an error result instead of throwing', async () => {
    vi.mocked(check).mockRejectedValue(new Error('offline'))
    const result = await checkForUpdate()
    expect(result.kind).toBe('error')
    expect(result).toMatchObject({ kind: 'error', message: expect.stringContaining('offline') })
  })

  // The updater plugin isn't linked into a mobile build, so no version is ever
  // queried there. Reporting `uptodate` would tell the user the app is current
  // on the strength of a check that never happened.
  it('reports unsupported on mobile rather than claiming the app is current', async () => {
    vi.resetModules()
    vi.doMock('@/lib/platform', () => ({ isIOS: true, isAndroid: false, isMobile: true }))
    try {
      const mobile = await import('./autoUpdate')
      expect(await mobile.checkForUpdate()).toEqual({ kind: 'unsupported' })
    } finally {
      vi.doUnmock('@/lib/platform')
      vi.resetModules()
    }
  })
})
