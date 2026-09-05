import { useTranslation } from 'react-i18next'
import { useStore, syncFailed } from '@/store'
import { syncConnect, syncDisconnect, syncNow } from '@/lib/commands'
import SettingsGroup from '@/components/elements/SettingsGroup'
import SettingsRow from '@/components/elements/SettingsRow'
import Button from '@/components/elements/Button'
import BackupRow from './BackupRow'
import ExportRow from './ExportRow'

const ErrorNote = ({ message }: { message: string }) => (
  <div data-testid="settings-sync-error" className="px-4 py-3 text-base text-bad">
    {message}
  </div>
)

export default function Sync() {
  const { t } = useTranslation()
  const sync = useStore(state => state.sync)

  // Consent happens in the browser: the backend says `sync:pending` when it
  // opens it and `sync:connected` / `sync:error` when it hears back, so nothing
  // here touches the store — on mobile the promise resolves as soon as Safari is
  // on screen. A rejection is the call itself failing (no client configured,
  // vault locked), which no event will report.
  const onConnect = () => {
    syncConnect().catch(error => syncFailed(String(error)))
  }

  const lastSynced = sync.inProgress
    ? t('Syncing…')
    : sync.success
      ? t('Up to date')
      : t('Last attempt failed')

  return (
    <>
      <SettingsGroup label={t('Account')}>
        <SettingsRow
          label={t('Google Drive')}
          description={
            sync.pending
              ? t('Waiting for Google…')
              : sync.enabled
                ? t('Connected')
                : t('Not connected')
          }
          testid="settings-drive-row"
          control={
            sync.enabled ? (
              <Button
                variant="pale"
                size="md"
                className="text-bad hover:text-bad"
                onClick={() => syncDisconnect()}
                testid="settings-drive-disconnect"
              >
                {t('Disconnect')}
              </Button>
            ) : (
              <Button
                variant="pale"
                size="md"
                loading={sync.pending || sync.inProgress}
                onClick={onConnect}
                testid="settings-drive-connect"
              >
                {t('Connect')}
              </Button>
            )
          }
        />
        {/* A connect that never got as far as being connected has no Sync
            group to report itself in, so it says so here instead. */}
        {!sync.enabled && sync.error && <ErrorNote message={sync.error} />}
      </SettingsGroup>

      {sync.enabled && (
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
        </SettingsGroup>
      )}

      <SettingsGroup label={t('Backup')}>
        <BackupRow />
        <ExportRow />
      </SettingsGroup>
    </>
  )
}
