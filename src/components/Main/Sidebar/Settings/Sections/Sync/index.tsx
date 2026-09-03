import { useState, useEffect } from 'react'
import { useStore } from '@/store'
import { syncConnect, syncDisconnect, syncNow } from '@/lib/commands'
import { t } from '@/i18n'
import SettingsGroup from '@/components/elements/SettingsGroup'
import SettingsRow from '@/components/elements/SettingsRow'
import Button from '@/components/elements/Button'
import BackupRow from './BackupRow'
import ExportRow from './ExportRow'

export default function Sync() {
  const sync = useStore(state => state.sync)
  const [connecting, setConnecting] = useState(false)

  // The OAuth round-trip lands as a store event, not a resolved promise, so the
  // spinner runs until `enabled` actually flips.
  useEffect(() => setConnecting(false), [sync.enabled])

  const onConnect = () => {
    setConnecting(true)
    syncConnect()
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
          description={sync.enabled ? t('Connected') : t('Not connected')}
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
                loading={connecting || sync.inProgress}
                onClick={onConnect}
                testid="settings-drive-connect"
              >
                {t('Connect')}
              </Button>
            )
          }
        />
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
          {sync.error && (
            <div
              data-testid="settings-sync-error"
              className="px-4 py-3 text-base text-bad"
            >
              {sync.error}
            </div>
          )}
        </SettingsGroup>
      )}

      <SettingsGroup label={t('Backup')}>
        <BackupRow />
        <ExportRow />
      </SettingsGroup>
    </>
  )
}
