import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Settings from '@/components/Main/Sidebar/Settings'
import i18n, { changeLocale } from '@/i18n'
import { dates } from '@/utils/time'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import type { SyncStatus } from '@/api/sync'
import {
  fileOpened,
  flowMain,
  initialApp,
  openSettings,
  setSyncStatus,
  useApp,
  usePrefs,
  useUi
} from '@/store'
import DateField from '@/components/elements/fields/DateField'
import { FieldsProvider } from '@/components/elements/fields/context'
import Footer from '@/components/Main/Body/Aside/Show/Footer'
import { appStatusDefault, calls, mockCommand, mockCommandOnce } from './ipc'
import { seedApp } from './utils'

beforeEach(() => vi.clearAllMocks())

const report = (s: Partial<SyncStatus>) => setSyncStatus({ ...initialApp.sync, ...s })

afterEach(() => changeLocale('en-US'))

// Only the biometric leaf of app_status matters here; the row reads nothing
// else. Seeded into the store as what the boot probe said, and returned by the
// mocked probe as what a re-run after a toggle says.
const enrolled = (available: boolean, mode: 'protected' | 'prompt' | null) => ({
  ...appStatusDefault(),
  biometric: { available, canEnroll: true, type: 'touch' as const, mode }
})

const open = async () => {
  const { container } = render(<Settings />)
  await userEvent.click(container.querySelector('.settings-button')!)
  return { container }
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
    await open()

    await go('audit')
    expect(screen.getByRole('heading', { name: 'Vault audit' })).toBeInTheDocument()
    expect(useUi.getState().settingsSection).toBe('audit')

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
    render(<Settings />)
    openSettings('security')
    expect(await screen.findByRole('heading', { name: 'Security' })).toBeInTheDocument()
  })

  it('closes from the header X', async () => {
    await open()
    await userEvent.click(screen.getByTestId('modal-close'))
    expect(useUi.getState().settings).toBe(false)
  })
})

describe('Settings › sync', () => {
  it('connects Google Drive', async () => {
    await open()
    await userEvent.click(screen.getByTestId('settings-drive-connect'))
    expect(calls('sync_connect')).toHaveLength(1)
  })

  // The mobile shape of the same flow: `sync_connect` resolves as soon as
  // Safari has the screen, so the row waits on the backend's events — the
  // click itself claims nothing.
  it('waits for Google after a connect that resolved early', async () => {
    await open()
    await userEvent.click(screen.getByTestId('settings-drive-connect'))
    expect(useApp.getState().sync.pending).toBe(false)

    report({ pending: true })
    expect(await screen.findByText('Waiting for Google…')).toBeInTheDocument()

    report({ configured: true })
    expect(await screen.findByText('Connected')).toBeInTheDocument()
  })

  it('reports a consent that failed, and stays disconnected', async () => {
    await open()
    await userEvent.click(screen.getByTestId('settings-drive-connect'))
    report({ pending: true })
    report({ error: 'access_denied' })

    expect(await screen.findByTestId('settings-sync-error')).toHaveTextContent(
      'access_denied'
    )
    expect(useApp.getState().sync.configured).toBe(false)
  })

  it('surfaces a connect that could not even start', async () => {
    mockCommandOnce('sync_connect', () => {
      report({ error: 'no OAuth client configured' })
      return Promise.reject({ kind: 'other', message: 'no OAuth client configured' })
    })
    await open()
    await userEvent.click(screen.getByTestId('settings-drive-connect'))

    await waitFor(() => expect(useApp.getState().sync.pending).toBe(false))
    expect(screen.getByTestId('settings-sync-error')).toHaveTextContent(
      'no OAuth client configured'
    )
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
    mockCommand('export_entries', () => '/tmp/rowel-export.json')
    await open()
    expect(
      screen.getByText('Bitwarden JSON, FIDO CXF or generic CSV, unencrypted')
    ).toBeInTheDocument()

    await userEvent.selectOptions(
      document.querySelector('select[name="export_format"]')!,
      'cxf'
    )
    await userEvent.click(screen.getByTestId('settings-export-run'))

    expect(calls('export_entries')).toContainEqual({ path: null, format: 'cxf' })
    expect(await screen.findByText(/rowel-export\.json/)).toBeInTheDocument()
  })
})

describe('Settings › security', () => {
  it('changes the master password', async () => {
    mockCommand('change_master_password', () => undefined)
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

    expect(calls('change_master_password')).toContainEqual({ current: 'old', new: 'newpass' })
    expect(await screen.findByTestId('change-password-success')).toBeInTheDocument()
  })

  it('reports a rejected master password change', async () => {
    mockCommand('change_master_password', () => Promise.reject({ kind: 'invalidPassword', message: 'invalid master password' }))
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

  // The row is redrawn from a fresh probe after the toggle, not from a guess.
  it('enables biometric unlock and redraws from the refreshed status', async () => {
    seedApp(enrolled(false, null))
    mockCommand('app_status', () => enrolled(true, 'protected'))
    mockCommand('enable_biometric', () => 'protected')
    await open()
    await go('security')

    const toggle = await screen.findByTestId('settings-biometric-toggle')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(toggle)

    expect(calls('enable_biometric')).toHaveLength(1)
    expect(await screen.findByTestId('settings-biometric-toggle')).toHaveAttribute(
      'aria-checked',
      'true'
    )
  })

  it('disables biometric unlock from the toggle', async () => {
    seedApp(enrolled(true, 'prompt'))
    mockCommand('app_status', () => enrolled(false, null))
    mockCommand('disable_biometric', () => undefined)
    await open()
    await go('security')

    await userEvent.click(await screen.findByTestId('settings-biometric-toggle'))

    expect(calls('disable_biometric')).toHaveLength(1)
    await waitFor(() =>
      expect(screen.getByTestId('settings-biometric-toggle')).toHaveAttribute(
        'aria-checked',
        'false'
      )
    )
  })

  // The copy must name the gate actually in force: an OS-enforced Secure Enclave
  // item and an app-enforced verify-then-read item are different promises.
  it('describes the OS-enforced gate when enrolled in protected mode', async () => {
    seedApp(enrolled(true, 'protected'))
    await open()
    await go('security')
    expect(await screen.findByText(/Secure Enclave/)).toBeInTheDocument()
  })

  it('switches the copy to the mode enrollment settled on', async () => {
    // An unentitled build falls back to prompt mode; the description must follow
    // the enable response rather than keep advertising the generic offer.
    seedApp(enrolled(false, null))
    mockCommand('app_status', () => enrolled(true, 'prompt'))
    mockCommand('enable_biometric', () => 'prompt')
    await open()
    await go('security')
    await userEvent.click(await screen.findByTestId('settings-biometric-toggle'))

    expect(
      await screen.findByText(/released after a biometric check by Rowel/)
    ).toBeInTheDocument()
  })

  // One write: Rust owns the file and re-arms the auto-lock from it, so there
  // is no second command to push the value with.
  it('stores the auto-lock choice through the settings file', async () => {
    await open()
    await go('security')
    await userEvent.click(screen.getByTestId('settings-autolock-300'))

    expect(usePrefs.getState().autolockSecs).toBe(300)
    expect(calls('set_settings')).toContainEqual({ patch: { autolockSecs: 300 } })
  })

  it('stores the clipboard delay, "Never" included', async () => {
    await open()
    await go('security')

    await userEvent.click(screen.getByTestId('settings-clipboard-15000'))
    expect(usePrefs.getState().clipboardTimeoutMs).toBe(15000)

    await userEvent.click(screen.getByTestId('settings-clipboard-0'))
    expect(usePrefs.getState().clipboardTimeoutMs).toBe(0)
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

    expect(usePrefs.getState().generator.symbols).toBe(false)
  })
})

describe('Settings › vault audit', () => {
  it('toggles breach monitoring and re-runs the audit', async () => {
    await open()
    await go('audit')

    expect(usePrefs.getState().breachCheck).toBe(false)
    await userEvent.click(screen.getByTestId('settings-breach-toggle'))

    expect(usePrefs.getState().breachCheck).toBe(true)
    expect(calls('get_audit')).toContainEqual({ checkBreaches: true })
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
    await open()
    await go('audit')
    await userEvent.click(screen.getByTestId('settings-open-health'))

    expect(useUi.getState().view).toBe('health')
    expect(useUi.getState().settings).toBe(false)
  })
})

describe('Settings › import', () => {
  it('imports a .swftx file with the source password', async () => {
    vi.mocked(openDialog).mockResolvedValue('/tmp/other.swftx')
    mockCommand('import_swftx', () => 3)
    await open()
    await go('import')

    await userEvent.click(screen.getByTestId('import-tile-swftx'))
    expect(await screen.findByText('other.swftx')).toBeInTheDocument()

    await userEvent.type(
      document.querySelector('input[name="import_password"]')!,
      'source-pw'
    )
    await userEvent.click(screen.getByTestId('import-run-backup'))

    expect(calls('import_swftx')).toContainEqual({ path: '/tmp/other.swftx', password: 'source-pw' })
    expect(await screen.findByText(/Imported/)).toBeInTheDocument()
  })

  it('shows an error when the backup password is wrong', async () => {
    vi.mocked(openDialog).mockResolvedValue('/tmp/other.swftx')
    mockCommand('import_swftx', () => Promise.reject({ kind: 'invalidPassword', message: 'invalid master password' }))
    await open()
    await go('import')

    await userEvent.click(screen.getByTestId('import-tile-swftx'))
    await screen.findByText('other.swftx')
    await userEvent.click(screen.getByTestId('import-run-backup'))

    expect(await screen.findByText('Invalid password for backup')).toBeInTheDocument()
  })

  // A legacy vault double-clicked while this one is open: Settings opens on
  // Import with it picked, as if from the tile, waiting for its password.
  it('picks a .swftx the OS opened with the app and asks for its password', async () => {
    flowMain()
    render(<Settings />)

    fileOpened('/tmp/old-vault.swftx')

    expect(useUi.getState().settings).toBe(true)
    expect(useUi.getState().settingsSection).toBe('import')
    expect(await screen.findByText('old-vault.swftx')).toBeInTheDocument()
    expect(document.querySelector('input[name="import_password"]')).toBeInTheDocument()
    expect(useApp.getState().openedFile).toBeNull()
  })

  // One of our own backups is a whole sealed database; with a vault already
  // open there is nothing to merge it into, and the section says so instead
  // of asking for a password it could not use.
  it('names a .rowel the OS opened and explains it is not imported', async () => {
    flowMain()
    render(<Settings />)

    fileOpened('/tmp/Rowel backup 2026-09-15.rowel')

    expect(await screen.findByText('Rowel backup 2026-09-15.rowel')).toBeInTheDocument()
    expect(screen.getByTestId('import-rowel-notice')).toBeInTheDocument()
    expect(document.querySelector('input[name="import_password"]')).not.toBeInTheDocument()
    expect(calls('import_swftx')).toEqual([])
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

  // The micro labels are uppercased by CSS, and `text-transform` follows the
  // document language: under `lang="en"` Turkish "i" becomes "I" rather than
  // "İ", misspelling every label in the Turkish UI.
  it('tells the document what language it is in', async () => {
    await open()
    await go('language')
    await userEvent.click(screen.getByTestId('settings-locale-tr-TR'))
    await waitFor(() => expect(document.documentElement.lang).toBe('tr-TR'))
  })

  it('sets the theme from the segmented control', async () => {
    await open()
    await go('language')
    await userEvent.click(screen.getByTestId('settings-theme-dark'))

    expect(usePrefs.getState().theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('offers System as a theme', async () => {
    await open()
    await go('language')
    await userEvent.click(screen.getByTestId('settings-theme-system'))
    expect(usePrefs.getState().theme).toBe('system')
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

    expect(dates(usePrefs.getState().dateFormat).dateTime(iso)).toMatch(/^01\/02\/2024/)

    await userEvent.click(screen.getByTestId('settings-date-format-DD.MM.YYYY'))
    expect(dates(usePrefs.getState().dateFormat).dateTime(iso)).toMatch(/^02\.01\.2024/)

    await userEvent.click(screen.getByTestId('settings-date-format-YYYY-MM-DD'))
    expect(dates(usePrefs.getState().dateFormat).dateTime(iso)).toMatch(/^2024-01-02/)
  })
})

describe('Settings › date format', () => {
  // Not just stored: a date already on screen has to be re-read in the new
  // pattern. The format used to be read at call time by helpers nothing
  // subscribed to, so every rendered date kept the pattern it was first drawn
  // in. Two consumers, on purpose: the date field, and the entry footer's
  // "Created" stamp, which formats a timestamp through `shortDate` rather than
  // through a field.
  it('re-renders every shown date when the format changes', async () => {
    render(
      <>
        <Settings />
        <FieldsProvider
          value={{
            entry: { type: 'apikey', title: '', expiry_date: '2035-06-01' },
            set: null,
            attempted: false
          }}
        >
          <DateField name="expiry_date" label="Expires" />
        </FieldsProvider>
        {/* Midday UTC, so the local date is the 15th in every zone a test runs in. */}
        <Footer tags={[]} createdAt="2024-01-15T12:00:00.000Z" />
      </>
    )
    await userEvent.click(document.querySelector('.settings-button')!)
    await go('language')

    expect(screen.getByText('06/01/2035')).toBeInTheDocument()
    expect(screen.getByText('01/15/2024')).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('settings-date-format-DD.MM.YYYY'))
    expect(await screen.findByText('01.06.2035')).toBeInTheDocument()
    expect(screen.getByText('15.01.2024')).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('settings-date-format-YYYY-MM-DD'))
    expect(await screen.findByText('2035-06-01')).toBeInTheDocument()
    expect(screen.getByText('2024-01-15')).toBeInTheDocument()
    expect(usePrefs.getState().dateFormat).toBe('YYYY-MM-DD')
  })
})
