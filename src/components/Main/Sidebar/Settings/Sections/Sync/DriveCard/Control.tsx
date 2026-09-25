import { useTranslation } from 'react-i18next'
import { useApp, forgetDrive } from '@/store'
import { syncConnect, syncNow } from '@/api/sync'
import Button from '@/components/elements/Button'
import { RefreshGlyph } from '../../../../../icons'

interface Props {
  probing: boolean
  offered: boolean
  restoring: boolean
}

// The header's one control: Sync now once connected, otherwise the way to
// connect — or, with the account's vaults on offer, the way back out of it.
export default function Control({ probing, offered, restoring }: Props) {
  const { t } = useTranslation()
  const sync = useApp(state => state.sync)

  if (sync.configured)
    return (
      <Button
        variant="pale"
        size="md"
        loading={sync.inProgress}
        onClick={() => syncNow()}
        testid="settings-sync-now"
      >
        <RefreshGlyph />
        {t('Sync now')}
      </Button>
    )

  // Withdrawn while the restore runs: the backend holds the account for its
  // length and would refuse the disconnect this is.
  if (offered)
    return restoring ? null : (
      <Button variant="pale" size="md" onClick={forgetDrive} testid="settings-drive-cancel">
        {t('Cancel')}
      </Button>
    )

  // Consent happens in the browser, and the backend reports every step of it
  // through the `setup:drive:*` events — the browser opening, the answer, a
  // failure — so nothing here touches the store. On mobile the promise resolves
  // as soon as Safari is on screen, and a rejection has already been reported
  // as status.
  return (
    <Button
      variant="pale"
      size="md"
      loading={sync.pending || sync.inProgress || probing}
      onClick={() => {
        syncConnect().catch(() => {})
      }}
      testid="settings-drive-connect"
    >
      {t('Connect')}
    </Button>
  )
}
