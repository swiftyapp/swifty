import { useTranslation } from 'react-i18next'
import { useApp } from '@/store'
import { syncConnect, syncDisconnect, syncNow } from '@/lib/commands'
import SettingsGroup from '@/components/elements/SettingsGroup'
import SettingsRow from '@/components/elements/SettingsRow'
import Button from '@/components/elements/Button'
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

  // Consent happens in the browser, and the backend reports every step of it
  // through `sync:status` — the browser opening, the answer, a failure — so
  // nothing here touches the store. On mobile the promise resolves as soon as
  // Safari is on screen, and a rejection has already been reported as status.
  const onConnect = () => {
    syncConnect().catch(() => {})
  }

  const lastSynced = sync.inProgress
    ? t('Syncing…')
    : sync.error === null
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
              : sync.configured
                ? t('Connected')
                : t('Not connected')
          }
          testid="settings-drive-row"
          control={
            sync.configured ? (
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
        {!sync.configured && sync.error && <ErrorNote message={sync.error} />}
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
