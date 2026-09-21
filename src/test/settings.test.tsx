import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Settings from '@/components/Main/Sidebar/Settings'
import i18n, { changeLocale } from '@/i18n'
import { dates } from '@/utils/time'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import type { SyncStatus } from '@/api/sync'
import type { SetupDriveFile } from '@/api/setup'
import {
  closeSettings,
  fileOpened,
  flowMain,
  initialApp,
  openSettings,
  setRemoteVaults,
  setSettingsSection,
  setSyncStatus,
  setupDriveFailed,
  setupDrivePending,
  setupDriveProbed,
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

  // Every workspace holds its own Drive connection and syncs its own pack now,
  // so a second one is offered the same controls as the primary rather than a
  // notice telling it where to go instead.
  it('offers Drive in a workspace that is not the primary', async () => {
    seedApp({
      workspaces: [
        { id: 'default', name: null },
        { id: 'w2', name: 'Work' }
      ],
      activeWorkspace: 'w2'
    })
    await open()

    expect(screen.queryByTestId('settings-sync-primary-only')).not.toBeInTheDocument()
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

  // Every connect is keyless and answered on the probe's events rather than on
  // `sync:status`: the backend probes the account, and `sync_adopt_pending`
  // then says whether this vault may join it — an empty account, or one that
  // already holds this vault — or whether its vaults are to be restored instead.
  describe('connecting a vault that is not connected', () => {
    // The backend's refusal: the account holds vaults, none of them this one.
    const refuse = () =>
      mockCommandOnce('sync_adopt_pending', () =>
        Promise.reject({
          kind: 'vaultNotInAccount',
          message: 'this Google account holds other vaults'
        })
      )

    it('waits on the probe, then takes an empty account as this vault', async () => {
      await open()
      await userEvent.click(screen.getByTestId('settings-drive-connect'))
      await act(async () => setupDrivePending())
      expect(await screen.findByText('Waiting for Google…')).toBeInTheDocument()

      await act(async () => setupDriveProbed([]))

      await waitFor(() => expect(calls('sync_adopt_pending')).toHaveLength(1))
      // The probe's state is spent once the account is this vault's; from here
      // on `sync:status` says the rest.
      await waitFor(() => expect(useApp.getState().setupDrive.status).toBe('idle'))
      report({ configured: true })
      expect(await screen.findByText('Connected')).toBeInTheDocument()
    })

    // A second device of a vault the account already holds: the backend adopts
    // and the picker is never shown.
    it('joins an account that already holds this vault, with no picker', async () => {
      await open()
      await userEvent.click(screen.getByTestId('settings-drive-connect'))
      await act(async () => setupDriveProbed([VAULT, OTHER_VAULT]))

      await waitFor(() => expect(calls('sync_adopt_pending')).toHaveLength(1))
      await waitFor(() => expect(useApp.getState().setupDrive.status).toBe('idle'))
      expect(screen.queryByTestId('settings-drive-found')).not.toBeInTheDocument()
      report({ configured: true })
      expect(await screen.findByText('Connected')).toBeInTheDocument()
    })

    // Until the backend has said, the row waits rather than offering vaults
    // the user may not need to choose from.
    it('waits while the backend decides, then follows its answer', async () => {
      let decide: () => void = () => {}
      mockCommandOnce(
        'sync_adopt_pending',
        () => new Promise<void>(resolve => (decide = resolve))
      )
      await open()
      await userEvent.click(screen.getByTestId('settings-drive-connect'))
      await act(async () => setupDriveProbed([VAULT]))

      await waitFor(() => expect(calls('sync_adopt_pending')).toHaveLength(1))
      expect(screen.getByText('Waiting for Google…')).toBeInTheDocument()
      expect(screen.queryByTestId('settings-drive-found')).not.toBeInTheDocument()

      await act(async () => decide())
      await waitFor(() => expect(useApp.getState().setupDrive.status).toBe('idle'))
    })

    // The account already says which vaults exist, so this vault does not add
    // to them: the user restores one, with the same picker and form Settings ›
    // Workspaces uses, and the vault that was open stays as its own workspace.
    it("offers the account's vaults to restore when it holds only other ones", async () => {
      refuse()
      await open()
      await userEvent.click(screen.getByTestId('settings-drive-connect'))
      await act(async () => setupDriveProbed([VAULT, OTHER_VAULT]))

      expect(await screen.findByTestId('settings-drive-found')).toBeInTheDocument()
      expect(screen.getByText('This account already holds a vault')).toBeInTheDocument()
      expect(screen.getByTestId(`drive-vault-${VAULT.id}`)).toBeInTheDocument()
      // Asked once, and refused; the tokens are still pending for the restore.
      expect(calls('sync_adopt_pending')).toHaveLength(1)
      expect(useApp.getState().setupDrive.status).toBe('found')

      await userEvent.click(screen.getByTestId(`drive-vault-${OTHER_VAULT.id}`))
      await userEvent.type(screen.getByTestId('workspace-restore-name'), 'Personal')
      await userEvent.type(screen.getByTestId('workspace-restore-password'), 'other-device-pass')
      await act(async () => {
        await userEvent.click(screen.getByTestId('workspace-restore-submit'))
      })

      expect(calls('workspace_restore_from_drive')).toContainEqual({
        name: 'Personal',
        password: 'other-device-pass',
        fileId: OTHER_VAULT.id
      })
    })

    it('cancels out of the offer by forgetting the account', async () => {
      refuse()
      await open()
      await userEvent.click(screen.getByTestId('settings-drive-connect'))
      await act(async () => setupDriveProbed([VAULT]))

      await userEvent.click(await screen.findByTestId('settings-drive-cancel'))

      expect(calls('setup_drive_disconnect')).toHaveLength(1)
      expect(screen.queryByTestId('settings-drive-found')).not.toBeInTheDocument()
      expect(screen.getByTestId('settings-drive-connect')).toBeInTheDocument()
    })

    // Any other reason the backend could not adopt (the account did not answer,
    // the vault locked) is a failure like the probe's, not an offer.
    it('reports an adopt that failed for another reason', async () => {
      mockCommandOnce('sync_adopt_pending', () =>
        Promise.reject({ kind: 'other', message: 'Google Drive did not answer' })
      )
      await open()
      await userEvent.click(screen.getByTestId('settings-drive-connect'))
      await act(async () => setupDriveProbed([]))

      expect(await screen.findByTestId('settings-sync-error')).toHaveTextContent(
        'Google Drive did not answer'
      )
      expect(screen.queryByTestId('settings-drive-found')).not.toBeInTheDocument()
      expect(screen.getByTestId('settings-drive-connect')).toBeInTheDocument()
    })

    it('reports a probe that failed, and offers to try again', async () => {
      await open()
      await userEvent.click(screen.getByTestId('settings-drive-connect'))
      await act(async () => setupDriveFailed('Google Drive did not answer'))

      expect(await screen.findByTestId('settings-sync-error')).toHaveTextContent(
        'Google Drive did not answer'
      )
      expect(screen.getByTestId('settings-drive-connect')).toBeInTheDocument()
      expect(useApp.getState().sync.configured).toBe(false)
    })
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

// What the probe reports for a vault in `Rowel/Vaults/` — the same payload the
// first run's picker is built from, because it is the same probe.
const VAULT: SetupDriveFile = {
  id: 'drive-file-1',
  name: '9f3c1a2b4d5e6f708192a3b4c5d6e7f8.rowel',
  vaultId: '9f3c1a2b4d5e6f708192a3b4c5d6e7f8',
  size: 1_258_291,
  modifiedTime: '2024-01-01T00:00:00.000Z'
}

// Another install's primary in the same account: a second pack, older, so the
// probe lists it after the first.
const OTHER_VAULT: SetupDriveFile = {
  id: 'drive-file-2',
  name: '11223344556677889900112233445566.rowel',
  vaultId: '11223344556677889900112233445566',
  size: 64_512,
  modifiedTime: '2023-06-02T00:00:00.000Z'
}

// Every device on an account is meant to hold every vault in it. A sync run
// reports the ones this device lacks (`workspaces:remote`), and the section
// offers them with the account the open workspace already has.
describe('Settings › workspaces › vaults in the account', () => {
  it('draws nothing while every vault in the account is here', async () => {
    await open()
    await go('workspaces')
    expect(screen.queryByTestId('workspace-remote-row')).not.toBeInTheDocument()
  })

  it('restores a vault the account holds and this device does not, with no sign-in', async () => {
    await open()
    await act(async () => setRemoteVaults([VAULT, OTHER_VAULT]))
    await go('workspaces')

    expect(screen.getByTestId('workspace-remote-row')).toBeInTheDocument()
    // Two vaults is a choice; the newest is picked to start with.
    expect(screen.getByTestId('remote-vault-drive-file-1')).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByTestId('remote-vault-drive-file-2'))
    await userEvent.type(screen.getByTestId('workspace-remote-name'), 'Personal')
    await userEvent.type(screen.getByTestId('workspace-remote-password'), 'other-device-pass')
    await act(async () => {
      await userEvent.click(screen.getByTestId('workspace-remote-submit'))
    })

    expect(calls('workspace_restore_from_account')).toEqual([
      { name: 'Personal', password: 'other-device-pass', fileId: 'drive-file-2' }
    ])
    // The open workspace's own tokens do the work: nothing is signed into.
    expect(calls('workspace_drive_connect')).toHaveLength(0)
    expect(calls('sync_connect')).toHaveLength(0)
    // It lands like every restore: active, unlocked, re-probed, first sync run.
    await waitFor(() => expect(useApp.getState().flow).toBe('main'))
    expect(calls('sync_now')).toHaveLength(1)
    // The list was the previous workspace's account's; the new one's run says again.
    expect(useApp.getState().remoteVaults).toEqual([])
  })

  // One vault is shown, not offered — and its list sits beside the probe's
  // picker without the two answering to the same ids.
  it("names the account's only missing vault without asking which", async () => {
    await open()
    await act(async () => setRemoteVaults([VAULT]))
    await go('workspaces')

    expect(screen.getByTestId('remote-found-file')).toBeInTheDocument()
    expect(screen.queryByTestId('remote-vault-drive-file-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('drive-found-file')).not.toBeInTheDocument()
  })

  it('holds Settings on the section while the restore runs', async () => {
    mockCommandOnce('workspace_restore_from_account', () => new Promise(() => {}))
    await open()
    await act(async () => setRemoteVaults([VAULT]))
    await go('workspaces')

    await userEvent.type(screen.getByTestId('workspace-remote-name'), 'Personal')
    await userEvent.type(screen.getByTestId('workspace-remote-password'), 'pass')
    await userEvent.click(screen.getByTestId('workspace-remote-submit'))

    expect(screen.getByTestId('workspace-remote-submit')).toHaveTextContent('Restoring…')
    expect(screen.getByTestId('modal-close')).toBeDisabled()
    expect(screen.getByTestId('settings-nav-sync')).toBeDisabled()
  })

  it('hands a wrong password back to the form', async () => {
    mockCommandOnce('workspace_restore_from_account', () =>
      Promise.reject({ kind: 'invalidPassword', message: 'wrong' })
    )
    await open()
    await act(async () => setRemoteVaults([VAULT]))
    await go('workspaces')

    await userEvent.type(screen.getByTestId('workspace-remote-name'), 'Personal')
    await userEvent.type(screen.getByTestId('workspace-remote-password'), 'wrong')
    await userEvent.click(screen.getByTestId('workspace-remote-submit'))

    expect(
      await screen.findByText(
        "That isn't the password this was sealed with. Try the one you use on your other devices."
      )
    ).toBeInTheDocument()
    expect(screen.getByTestId('workspace-remote-submit')).toHaveTextContent('Restore')
    expect(useUi.getState().settingsLocked).toBe(false)
  })
})

// Local only: the vault leaves this device and whatever it has on Drive stays,
// so the confirmation asks for two proofs — the workspace's own master password
// and its label typed out — before anything is removed.
describe('Settings › workspaces › delete', () => {
  const two = () =>
    seedApp({
      workspaces: [
        { id: 'default', name: null },
        { id: 'w2', name: 'Work' }
      ],
      activeWorkspace: 'default'
    })

  const openDelete = async (id: string) => {
    two()
    await open()
    await go('workspaces')
    await userEvent.click(screen.getByTestId(`workspace-delete-${id}`))
    return screen.getByTestId('workspace-delete-dialog')
  }

  it('opens the confirmation on the workspace that was chosen', async () => {
    await openDelete('w2')

    expect(screen.getByTestId('workspace-delete-dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Delete Work?' })).toBeInTheDocument()
    expect(
      screen.getByText(/A copy on Google Drive is left where it is/)
    ).toBeInTheDocument()
  })

  it('holds Delete until the label is typed back', async () => {
    await openDelete('w2')

    const submit = screen.getByTestId('workspace-delete-submit')
    expect(submit).toBeDisabled()

    await userEvent.type(screen.getByTestId('workspace-delete-password'), 'work-pass')
    expect(submit).toBeDisabled()

    await userEvent.type(screen.getByTestId('workspace-delete-confirm'), 'Wor')
    expect(submit).toBeDisabled()

    await userEvent.type(screen.getByTestId('workspace-delete-confirm'), 'k')
    expect(submit).toBeEnabled()
  })

  it('deletes with the id and that workspace’s password', async () => {
    mockCommand('workspace_delete', () => undefined)
    await openDelete('w2')

    await userEvent.type(screen.getByTestId('workspace-delete-password'), 'work-pass')
    await userEvent.type(screen.getByTestId('workspace-delete-confirm'), 'Work')
    await act(async () => {
      await userEvent.click(screen.getByTestId('workspace-delete-submit'))
    })

    expect(calls('workspace_delete')).toEqual([{ id: 'w2', password: 'work-pass' }])
    // The probe is what carries the list, so a delete ends by re-reading it.
    expect(calls('app_status').length).toBeGreaterThan(0)
    await waitFor(() =>
      expect(screen.queryByTestId('workspace-delete-dialog')).not.toBeInTheDocument()
    )
  })

  // The open workspace may go too: the backend ends its session and announces
  // the lock, which is what lands on the survivor's lock screen.
  it('offers the delete on the current workspace as well', async () => {
    await openDelete('default')
    expect(screen.getByRole('heading', { name: 'Delete Personal?' })).toBeInTheDocument()
  })

  it('blames the password only when the backend does', async () => {
    mockCommandOnce('workspace_delete', () =>
      Promise.reject({ kind: 'invalidPassword', message: 'invalid master password' })
    )
    await openDelete('w2')

    await userEvent.type(screen.getByTestId('workspace-delete-password'), 'wrong')
    await userEvent.type(screen.getByTestId('workspace-delete-confirm'), 'Work')
    await userEvent.click(screen.getByTestId('workspace-delete-submit'))

    expect(await screen.findByTestId('workspace-delete-error')).toHaveTextContent(
      'That is not this workspace’s master password'
    )
    expect(screen.getByTestId('workspace-delete-dialog')).toBeInTheDocument()
  })

  // A device always has a vault to open, and the control says so rather than
  // letting the user find out from a rejection.
  it('withdraws the delete when there is only one workspace', async () => {
    await open()
    await go('workspaces')

    expect(screen.getByTestId('workspace-delete-default')).toBeDisabled()
    expect(screen.getByTestId('workspace-delete-last')).toBeInTheDocument()
  })
})

describe('Settings › workspaces › restore from Drive', () => {
  // Consent, then the probe's answer — which arrives as an event, never through
  // the connect's promise.
  const connect = async (files: SetupDriveFile[]) => {
    await open()
    await go('workspaces')
    await userEvent.click(screen.getByTestId('workspace-restore-connect'))
    await act(async () => setupDriveProbed(files))
  }

  it('restores the vault the user picked as a workspace of its own', async () => {
    await connect([VAULT, OTHER_VAULT])

    expect(calls('workspace_drive_connect')).toHaveLength(1)
    // Two vaults is a choice, so both are offered rather than one picked.
    expect(screen.getByTestId('drive-vault-drive-file-1')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('drive-vault-drive-file-2'))

    await userEvent.type(screen.getByTestId('workspace-restore-name'), 'Work')
    await userEvent.type(screen.getByTestId('workspace-restore-password'), 'other-device-pass')
    await act(async () => {
      await userEvent.click(screen.getByTestId('workspace-restore-submit'))
    })

    expect(calls('workspace_restore_from_drive')).toEqual([
      { name: 'Work', password: 'other-device-pass', fileId: 'drive-file-2' }
    ])
    // It arrives active and unlocked, so the app lands in main and re-probes —
    // which is what brings the new workspace on screen.
    await waitFor(() => expect(useApp.getState().flow).toBe('main'))
    expect(calls('app_status').length).toBeGreaterThan(0)
    // Connected on arrival, so the first sync runs exactly as it does after the
    // first run's restore. (`sync.configured` is not asserted: the re-probe
    // that follows overwrites it from the fake backend's status, which knows
    // nothing about the workspace that was just restored.)
    expect(calls('sync_now')).toHaveLength(1)
  })

  // The vault already has a name, given wherever it was made, and it travels in
  // the pack — so leaving the field blank is a restore, not a validation error.
  it('restores without a name and lets the pack supply one', async () => {
    await connect([VAULT])

    await userEvent.type(screen.getByTestId('workspace-restore-password'), 'other-device-pass')
    await act(async () => {
      await userEvent.click(screen.getByTestId('workspace-restore-submit'))
    })

    expect(calls('workspace_restore_from_drive')).toEqual([
      { name: '', password: 'other-device-pass', fileId: VAULT.id }
    ])
  })

  // One vault in the account is not a choice: it is shown, not offered.
  it("names the account's only vault without asking which", async () => {
    await connect([VAULT])

    expect(screen.getByTestId('drive-found-file')).toBeInTheDocument()
    expect(screen.queryByTestId('drive-vault-drive-file-1')).not.toBeInTheDocument()
  })

  // Backing out has to reach the backend: tokens left pending would otherwise
  // be adopted by whatever create or restore came next.
  it('forgets the connected account when the dialog is cancelled', async () => {
    await connect([VAULT])

    await userEvent.click(screen.getByTestId('workspace-restore-cancel'))

    expect(calls('setup_drive_disconnect')).toHaveLength(1)
    expect(useApp.getState().setupDrive.status).toBe('idle')
    expect(screen.getByTestId('workspace-restore-connect')).toBeInTheDocument()
  })

  // Once the restore is running the backend holds the account for its length
  // and would refuse to drop it, so nothing on screen may offer to: a Cancel
  // that did nothing would read as a cancellation that happened.
  it('withdraws Cancel and Switch account while the restore runs', async () => {
    mockCommandOnce('workspace_restore_from_drive', () => new Promise(() => {}))
    await connect([VAULT])

    await userEvent.type(screen.getByTestId('workspace-restore-name'), 'Work')
    await userEvent.type(screen.getByTestId('workspace-restore-password'), 'pass')
    await userEvent.click(screen.getByTestId('workspace-restore-submit'))

    expect(useApp.getState().setupDrive.status).toBe('restoring')
    expect(screen.queryByTestId('workspace-restore-cancel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('workspace-restore-switch-account')).not.toBeInTheDocument()
    expect(screen.getByTestId('workspace-restore-submit')).toHaveTextContent('Restoring…')
    expect(calls('setup_drive_disconnect')).toHaveLength(0)
  })

  // Leaving Settings would unmount the row and run the same refused disconnect,
  // then the restore would finish and switch workspaces behind the user's back.
  // So Settings stays shut on its section — from the X, from the nav, and from
  // anything else that reaches the store — until the restore lands.
  it('holds Settings on the section while the restore runs', async () => {
    mockCommandOnce('workspace_restore_from_drive', () => new Promise(() => {}))
    await connect([VAULT])

    await userEvent.type(screen.getByTestId('workspace-restore-name'), 'Work')
    await userEvent.type(screen.getByTestId('workspace-restore-password'), 'pass')
    await userEvent.click(screen.getByTestId('workspace-restore-submit'))

    expect(screen.getByTestId('modal-close')).toBeDisabled()
    expect(screen.getByTestId('settings-nav-sync')).toBeDisabled()
    // The store refuses too, whoever asks.
    closeSettings()
    setSettingsSection('sync')
    expect(useUi.getState().settings).toBe(true)
    expect(useUi.getState().settingsSection).toBe('workspaces')
  })

  // A failed restore gives Settings back with the form.
  it('releases Settings when the restore fails', async () => {
    mockCommandOnce('workspace_restore_from_drive', () =>
      Promise.reject({ kind: 'invalidPassword', message: 'invalid master password' })
    )
    await connect([VAULT])

    await userEvent.type(screen.getByTestId('workspace-restore-name'), 'Work')
    await userEvent.type(screen.getByTestId('workspace-restore-password'), 'wrong')
    await userEvent.click(screen.getByTestId('workspace-restore-submit'))

    await waitFor(() => expect(useUi.getState().settingsLocked).toBe(false))
    expect(screen.getByTestId('modal-close')).toBeEnabled()
    await userEvent.click(screen.getByTestId('modal-close'))
    expect(useUi.getState().settings).toBe(false)
  })

  // A failed restore hands the form back: the list and the pick are still
  // there, and so are Cancel and Switch account.
  it('hands the form back when the restore fails', async () => {
    mockCommandOnce('workspace_restore_from_drive', () =>
      Promise.reject({ kind: 'invalidPassword', message: 'invalid master password' })
    )
    await connect([VAULT])

    await userEvent.type(screen.getByTestId('workspace-restore-name'), 'Work')
    await userEvent.type(screen.getByTestId('workspace-restore-password'), 'wrong')
    await userEvent.click(screen.getByTestId('workspace-restore-submit'))

    await waitFor(() => expect(useApp.getState().setupDrive.status).toBe('found'))
    expect(screen.getByTestId('workspace-restore-cancel')).toBeInTheDocument()
    expect(screen.getByTestId('workspace-restore-switch-account')).toBeInTheDocument()
  })

  it('blames the password only when the backend does', async () => {
    mockCommandOnce('workspace_restore_from_drive', () =>
      Promise.reject({ kind: 'invalidPassword', message: 'invalid master password' })
    )
    await connect([VAULT])

    await userEvent.type(screen.getByTestId('workspace-restore-name'), 'Work')
    await userEvent.type(screen.getByTestId('workspace-restore-password'), 'wrong')
    await userEvent.click(screen.getByTestId('workspace-restore-submit'))

    expect(
      await screen.findByText(
        "That isn't the password this was sealed with. Try the one you use on your other devices."
      )
    ).toBeInTheDocument()
    expect(useApp.getState().flow).not.toBe('main')
  })

  // The pack is already a workspace here — the open one, or a locked one the
  // registry remembers; the backend says which is not the point, only that it is.
  it('says so when the chosen vault is already a workspace on this device', async () => {
    mockCommandOnce('workspace_restore_from_drive', () =>
      Promise.reject({
        kind: 'vaultAlreadyOpen',
        message: 'this vault is already a workspace on this device'
      })
    )
    await connect([VAULT])

    await userEvent.type(screen.getByTestId('workspace-restore-name'), 'Copy')
    await userEvent.type(screen.getByTestId('workspace-restore-password'), 'pass')
    await userEvent.click(screen.getByTestId('workspace-restore-submit'))

    expect(
      await screen.findByText('This vault is already a workspace on this device')
    ).toBeInTheDocument()
  })

  it('reports a consent that never came back', async () => {
    await open()
    await go('workspaces')
    await userEvent.click(screen.getByTestId('workspace-restore-connect'))
    expect(screen.getByTestId('workspace-restore-waiting')).toBeInTheDocument()

    await act(async () => setupDriveFailed('access_denied'))

    expect(await screen.findByTestId('workspace-restore-error')).toHaveTextContent(
      'access_denied'
    )
    expect(calls('workspace_restore_from_drive')).toHaveLength(0)
  })
})
