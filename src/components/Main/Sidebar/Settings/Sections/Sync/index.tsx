import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp, forgetDrive, setupDriveFailed, setupDriveReset } from '@/store'
import { syncAdoptPending, syncConnect, syncDisconnect, syncNow } from '@/api/sync'
import { describeError } from '@/api/errors'
import SettingsGroup from '@/components/elements/SettingsGroup'
import SettingsRow from '@/components/elements/SettingsRow'
import Button from '@/components/elements/Button'
import DriveRestoreForm from '@/components/elements/DriveRestoreForm'
import BackupRow from './BackupRow'
import ExportRow from './ExportRow'
import SharesRow from './SharesRow'

const ErrorNote = ({ message }: { message: string }) => (
  <div data-testid="settings-sync-error" className="px-4 py-3 text-base text-bad">
    {message}
  </div>
)

export default function Sync() {
  const { t } = useTranslation()
  const sync = useApp(state => state.sync)
  // A connect on a vault that has never synced answers here rather than on
  // `sync` (see `syncConnect`): the account is probed first, and what it holds
  // decides whether this vault joins it or one of its vaults is restored.
  const drive = useApp(state => state.setupDrive)

  // Leaving the section forgets a probe's pending account, as Settings ›
  // Workspaces does: a sign-in the user walked away from is never adopted later.
  // Only when there is one to forget — this is the section Settings opens on,
  // so every visit to another section would otherwise cost a backend call.
  useEffect(
    () => () => {
      if (useApp.getState().setupDrive.status !== 'idle') forgetDrive()
    },
    []
  )

  // An empty account has nothing to choose: this vault becomes its first. Once
  // per probe — the status outlives the call, and a second adopt would find the
  // tokens already taken.
  const adopted = useRef(false)
  useEffect(() => {
    if (drive.status !== 'empty') {
      adopted.current = false
      return
    }
    if (adopted.current) return
    adopted.current = true
    syncAdoptPending().then(setupDriveReset, (error: unknown) =>
      setupDriveFailed(describeError(error))
    )
  }, [drive.status])

  // Consent happens in the browser, and the backend reports every step of it
  // through `sync:status` — the browser opening, the answer, a failure — so
  // nothing here touches the store. On mobile the promise resolves as soon as
  // Safari is on screen, and a rejection has already been reported as status.
  const onConnect = () => {
    syncConnect().catch(() => {})
  }

  const probing = drive.status === 'pending' || drive.status === 'empty'
  const found = drive.status === 'found' || drive.status === 'restoring'
  const restoring = drive.status === 'restoring'

  const lastSynced = sync.inProgress
    ? t('Syncing…')
    : sync.error === null
      ? t('Up to date')
      : t('Last attempt failed')

  const description =
    sync.pending || probing
      ? t('Waiting for Google…')
      : found
        ? t('This account already holds a vault')
        : sync.configured
          ? t('Connected')
          : t('Not connected')

  const control = sync.configured ? (
    <Button
      variant="pale"
      size="md"
      className="text-bad hover:text-bad"
      onClick={() => syncDisconnect()}
      testid="settings-drive-disconnect"
    >
      {t('Disconnect')}
    </Button>
  ) : found ? (
    // Withdrawn while the restore runs: the backend holds the account for its
    // length and would refuse the disconnect this is.
    restoring ? null : (
      <Button variant="pale" size="md" onClick={forgetDrive} testid="settings-drive-cancel">
        {t('Cancel')}
      </Button>
    )
  ) : (
    <Button
      variant="pale"
      size="md"
      loading={sync.pending || sync.inProgress || probing}
      onClick={onConnect}
      testid="settings-drive-connect"
    >
      {t('Connect')}
    </Button>
  )

  return (
    <>
      <SettingsGroup label={t('Account')}>
        <SettingsRow
          label={t('Google Drive')}
          description={description}
          testid="settings-drive-row"
          control={control}
        >
          {found && (
            <div className="flex flex-col gap-3">
              <p data-testid="settings-drive-found" className="text-base text-text2">
                {t(
                  'Restore it here to sync the same data on this device. The vault open now stays as a workspace of its own.'
                )}
              </p>
              <DriveRestoreForm
                files={drive.files}
                selectedId={drive.selectedId}
                busy={restoring}
              />
            </div>
          )}
        </SettingsRow>
        {/* A connect that never got as far as being connected has no Sync
            group to report itself in, so it says so here instead. */}
        {!sync.configured && sync.error && <ErrorNote message={sync.error} />}
        {drive.status === 'error' && (
          <ErrorNote message={drive.error || t('Something went wrong')} />
        )}
      </SettingsGroup>

      {sync.configured && (
        <SettingsGroup label={t('Sync')}>
          <SettingsRow
            label={t('Last synced')}
            description={lastSynced}
            control={
              <Button
                variant="pale"
                size="md"
                loading={sync.inProgress}
                onClick={() => syncNow()}
                testid="settings-sync-now"
              >
                {t('Sync now')}
              </Button>
            }
          />
          {sync.error && <ErrorNote message={sync.error} />}
          <SharesRow />
        </SettingsGroup>
      )}

      <SettingsGroup label={t('Backup')}>
        <BackupRow />
        <ExportRow />
      </SettingsGroup>
    </>
  )
}
