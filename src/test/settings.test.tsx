import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Settings from '@/components/Main/Sidebar/Settings'
import i18n, { changeLocale } from '@/i18n'
import { getTimeout } from '@/defaults/clipboard'
import { getSecs } from '@/defaults/autolock'
import { dateTime } from '@/utils/time'
import {
  changeMasterPassword,
  biometricStatus,
  enableBiometric,
  disableBiometric,
  pickBackup,
  importSwftx,
  exportEntries,
  syncConnect,
  setAutolockTimeout,
  getAudit
} from '@/lib/commands'
import { renderWithStore } from './utils'

beforeEach(() => {
  vi.clearAllMocks()
  // Every panel reads its initial value from localStorage, so leftovers from an
  // earlier case would decide which segment starts selected.
  localStorage.removeItem('swifty:clipboardTimeout')
  localStorage.removeItem('swifty:autolockSecs')
  localStorage.removeItem('swifty:dateFormat')
})

afterEach(() => changeLocale('en-US'))

const open = async () => {
  const { container, store } = renderWithStore(<Settings />)
  await userEvent.click(container.querySelector('.settings-button')!)
  return { container, store }
}

const go = (section: string) =>
  userEvent.click(screen.getByTestId(`settings-nav-${section}`))

describe('Settings shell', () => {
  it('opens on the sync section', async () => {
    await open()
    expect(screen.getByTestId('settings-modal')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sync & devices' })).toBeInTheDocument()
    expect(screen.getByTestId('settings-nav-sync')).toHaveAttribute('aria-current', 'page')
  })

  it('switches sections from the nav and remembers the last one', async () => {
    const { store } = await open()

    await go('audit')
    expect(screen.getByRole('heading', { name: 'Vault audit' })).toBeInTheDocument()
    expect(store.getState().ui.settingsSection).toBe('audit')

    await go('language')
    expect(
      screen.getByRole('heading', { name: 'Language & region' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('settings-nav-language')).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('deep-links to a section through openSettings', async () => {
    const { store } = renderWithStore(<Settings />)
    store.getState().openSettings('security')
    expect(await screen.findByRole('heading', { name: 'Security' })).toBeInTheDocument()
  })

  it('closes from the header X', async () => {
    const { store } = await open()
    await userEvent.click(screen.getByTestId('modal-close'))
    expect(store.getState().ui.settings).toBe(false)
  })
})

describe('Settings › sync', () => {
  it('connects Google Drive', async () => {
    await open()
    await userEvent.click(screen.getByTestId('settings-drive-connect'))
    expect(syncConnect).toHaveBeenCalledOnce()
  })

  it('offers the encrypted backup behind its own control', async () => {
    await open()
    expect(document.querySelector('input[name="export_password"]')).toBeNull()
    await userEvent.click(screen.getByText('Save…'))
    expect(document.querySelector('input[name="export_password"]')).toBeInTheDocument()
  })

  // One warning covers the whole picker, CXF included — it is as plaintext as
  // the other two.
  it('exports to CXF from the portable export picker', async () => {
    vi.mocked(exportEntries).mockResolvedValue('/tmp/swifty-export.json')
    await open()
    expect(
      screen.getByText('Bitwarden JSON, FIDO CXF or generic CSV, unencrypted')
    ).toBeInTheDocument()

    await userEvent.selectOptions(
      document.querySelector('select[name="export_format"]')!,
      'cxf'
    )
    await userEvent.click(screen.getByTestId('settings-export-run'))

    expect(exportEntries).toHaveBeenCalledWith('cxf')
    expect(await screen.findByText(/swifty-export\.json/)).toBeInTheDocument()
  })
})

describe('Settings › security', () => {
  it('changes the master password', async () => {
    vi.mocked(changeMasterPassword).mockResolvedValue(undefined)
    await open()
    await go('security')
    await userEvent.click(screen.getByText('Change…'))

    await userEvent.type(document.querySelector('input[name="current_password"]')!, 'old')
    await userEvent.type(document.querySelector('input[name="new_password"]')!, 'newpass')
    await userEvent.type(
      document.querySelector('input[name="new_password_repeat"]')!,
      'newpass'
    )
    await userEvent.click(screen.getByTestId('change-password-submit'))

    expect(changeMasterPassword).toHaveBeenCalledWith('old', 'newpass')
    expect(await screen.findByTestId('change-password-success')).toBeInTheDocument()
  })

  it('reports a rejected master password change', async () => {
    vi.mocked(changeMasterPassword).mockRejectedValue(new Error('nope'))
    await open()
    await go('security')
    await userEvent.click(screen.getByText('Change…'))

    await userEvent.type(document.querySelector('input[name="current_password"]')!, 'bad')
    await userEvent.type(document.querySelector('input[name="new_password"]')!, 'newpass')
    await userEvent.type(
      document.querySelector('input[name="new_password_repeat"]')!,
      'newpass'
    )
    await userEvent.click(screen.getByTestId('change-password-submit'))

    expect(await screen.findByTestId('change-password-error')).toBeInTheDocument()
  })

  it('enables biometric unlock from the toggle', async () => {
    vi.mocked(biometricStatus).mockResolvedValue({ enabled: false, mode: null })
    vi.mocked(enableBiometric).mockResolvedValue('protected')
    await open()
    await go('security')

    const toggle = await screen.findByTestId('settings-biometric-toggle')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(toggle)

    expect(enableBiometric).toHaveBeenCalledOnce()
    expect(await screen.findByTestId('settings-biometric-toggle')).toHaveAttribute(
      'aria-checked',
      'true'
    )
  })

  it('disables biometric unlock from the toggle', async () => {
    vi.mocked(biometricStatus).mockResolvedValue({ enabled: true, mode: 'prompt' })
    vi.mocked(disableBiometric).mockResolvedValue(undefined)
    await open()
    await go('security')

    await userEvent.click(await screen.findByTestId('settings-biometric-toggle'))

    expect(disableBiometric).toHaveBeenCalledOnce()
    expect(screen.getByTestId('settings-biometric-toggle')).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })

  // The copy must name the gate actually in force: an OS-enforced Secure Enclave
  // item and an app-enforced verify-then-read item are different promises.
  it('describes the OS-enforced gate when enrolled in protected mode', async () => {
    vi.mocked(biometricStatus).mockResolvedValue({ enabled: true, mode: 'protected' })
    await open()
    await go('security')
    expect(await screen.findByText(/Secure Enclave/)).toBeInTheDocument()
  })

  it('switches the copy to the mode enrollment settled on', async () => {
    // An unentitled build falls back to prompt mode; the description must follow
    // the enable response rather than keep advertising the generic offer.
    vi.mocked(biometricStatus).mockResolvedValue({ enabled: false, mode: null })
    vi.mocked(enableBiometric).mockResolvedValue('prompt')
    await open()
    await go('security')
    await userEvent.click(await screen.findByTestId('settings-biometric-toggle'))

    expect(
      await screen.findByText(/released after a biometric check by Swifty/)
    ).toBeInTheDocument()
  })

  it('stores the auto-lock choice and pushes it to the backend', async () => {
    await open()
    await go('security')
    await userEvent.click(screen.getByTestId('settings-autolock-300'))

    expect(getSecs()).toBe(300)
    expect(setAutolockTimeout).toHaveBeenCalledWith(300)
  })

  it('stores the clipboard delay, "Never" included', async () => {
    await open()
    await go('security')

    await userEvent.click(screen.getByTestId('settings-clipboard-15000'))
    expect(getTimeout()).toBe(15000)

    await userEvent.click(screen.getByTestId('settings-clipboard-0'))
    expect(getTimeout()).toBe(0)
  })

  it('names both session radiogroups after their rows', async () => {
    await open()
    await go('security')

    expect(screen.getByRole('radiogroup', { name: 'Lock vault after' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Clear clipboard' })).toBeInTheDocument()
  })

  it('writes the generator defaults the dialog reads', async () => {
    await open()
    await go('security')

    await userEvent.click(screen.getByTestId('settings-generator-symbols'))

    const stored = JSON.parse(localStorage.getItem('swifty:generatorDefaults')!)
    expect(stored.symbols).toBe(false)
  })
})

describe('Settings › vault audit', () => {
  it('toggles breach monitoring and re-runs the audit', async () => {
    const { store } = await open()
    await go('audit')

    expect(store.getState().breachCheck).toBe(false)
    await userEvent.click(screen.getByTestId('settings-breach-toggle'))

    expect(store.getState().breachCheck).toBe(true)
    expect(getAudit).toHaveBeenCalledWith(true)
  })

  it('leaves the always-on monitors without a fake control', async () => {
    await open()
    await go('audit')
    expect(screen.getByText('Weak passwords')).toBeInTheDocument()
    expect(screen.getByText('Reused passwords')).toBeInTheDocument()
    // Breach monitoring is the only switch on this section.
    expect(screen.getAllByRole('switch')).toHaveLength(1)
  })

  it('jumps to the Vault Health view and closes', async () => {
    const { store } = await open()
    await go('audit')
    await userEvent.click(screen.getByTestId('settings-open-health'))

    expect(store.getState().ui.view).toBe('health')
    expect(store.getState().ui.settings).toBe(false)
  })
})

describe('Settings › import', () => {
  it('imports a .swftx file with the source password', async () => {
    vi.mocked(pickBackup).mockResolvedValue('/tmp/other.swftx')
    vi.mocked(importSwftx).mockResolvedValue(3)
    await open()
    await go('import')

    await userEvent.click(screen.getByTestId('import-tile-swftx'))
    expect(await screen.findByText('other.swftx')).toBeInTheDocument()

    await userEvent.type(
      document.querySelector('input[name="import_password"]')!,
      'source-pw'
    )
    await userEvent.click(screen.getByTestId('import-run-backup'))

    expect(importSwftx).toHaveBeenCalledWith('/tmp/other.swftx', 'source-pw')
    expect(await screen.findByText(/Imported/)).toBeInTheDocument()
  })

  it('shows an error when the backup password is wrong', async () => {
    vi.mocked(pickBackup).mockResolvedValue('/tmp/other.swftx')
    vi.mocked(importSwftx).mockRejectedValue(new Error('invalid password'))
    await open()
    await go('import')

    await userEvent.click(screen.getByTestId('import-tile-swftx'))
    await screen.findByText('other.swftx')
    await userEvent.click(screen.getByTestId('import-run-backup'))

    expect(await screen.findByText('Invalid password for backup')).toBeInTheDocument()
  })

  it('offers a tile per source and no format select', async () => {
    await open()
    await go('import')
    for (const key of [
      'bitwarden',
      'cxf',
      'chrome',
      'lastpass',
      'keepass',
      'csv',
      'swftx'
    ])
      expect(screen.getByTestId(`import-tile-${key}`)).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})

describe('Settings › language & region', () => {
  it('picks a language from the radio list', async () => {
    await open()
    await go('language')
    await userEvent.click(screen.getByTestId('settings-locale-de-DE'))
    // Switching is async now: the de-DE catalogue is a dynamic import, fetched
    // on demand rather than bundled with the app.
    await waitFor(() => expect(i18n.resolvedLanguage).toBe('de-DE'))
  })

  // The mono labels are uppercased by CSS, and `text-transform` follows the
  // document language: under `lang="en"` Turkish "i" becomes "I" rather than
  // "İ", misspelling every label in the Turkish UI.
  it('tells the document what language it is in', async () => {
    await open()
    await go('language')
    await userEvent.click(screen.getByTestId('settings-locale-tr-TR'))
    await waitFor(() => expect(document.documentElement.lang).toBe('tr-TR'))
  })

  it('sets the theme from the segmented control', async () => {
    const { store } = await open()
    await go('language')
    await userEvent.click(screen.getByTestId('settings-theme-dark'))

    expect(store.getState().theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('offers System as a theme', async () => {
    const { store } = await open()
    await go('language')
    await userEvent.click(screen.getByTestId('settings-theme-system'))
    expect(store.getState().theme).toBe('system')
  })

  it('names both region radiogroups after their rows', async () => {
    await open()
    await go('language')

    expect(screen.getByRole('radiogroup', { name: 'Date format' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument()
  })

  it('applies the date format to rendered timestamps', async () => {
    const iso = new Date(2024, 0, 2, 10, 30).toISOString()
    await open()
    await go('language')

    expect(dateTime(iso)).toMatch(/^01\/02\/2024/)

    await userEvent.click(screen.getByTestId('settings-date-format-DD.MM.YYYY'))
    expect(dateTime(iso)).toMatch(/^02\.01\.2024/)

    await userEvent.click(screen.getByTestId('settings-date-format-YYYY-MM-DD'))
    expect(dateTime(iso)).toMatch(/^2024-01-02/)
  })
})
