import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { shareList, shareRevoke, type ActiveShare } from '@/lib/commands'
import { useStore } from '@/store'
import { kindOf } from '@/kinds'
import { relativeUntil } from '@/utils/time'
import Button from '@/components/elements/Button'
import ExpandableRow from '../ExpandableRow'

// The list, mounted only while the row is unfolded — which is what makes the
// fetch happen on expand rather than on every visit to this pane.
function Shares() {
  const { t } = useTranslation()
  const entries = useStore(state => state.entries.items)
  const [shares, setShares] = useState<ActiveShare[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    shareList()
      .then(list => live && setShares(list))
      .catch(reason => live && setError(String(reason)))
    return () => {
      live = false
    }
  }, [])

  // A share outlives the entry it was cut from: it is a copy, and deleting the
  // original neither revokes it nor gives it a title back.
  const titleOf = (share: ActiveShare) =>
    entries.find(entry => entry.id === share.entryId)?.title ?? t('Deleted entry')

  const revoke = (fileId: string) => {
    shareRevoke(fileId)
      .then(() => setShares(list => (list ?? []).filter(share => share.fileId !== fileId)))
      .catch(reason => setError(String(reason)))
  }

  if (error)
    return (
      <div data-testid="settings-shares-error" className="text-base text-bad">
        {error}
      </div>
    )

  if (!shares)
    return <div className="text-base text-text3">{t('Loading…')}</div>

  if (shares.length === 0)
    return (
      <div data-testid="settings-shares-empty" className="text-base text-text3">
        {t('No active links')}
      </div>
    )

  return (
    <ul data-testid="settings-shares-list" className="flex flex-col gap-2">
      {shares.map(share => {
        const left = relativeUntil(share.expiresAt)
        return (
          <li
            key={share.fileId}
            data-testid={`settings-share-${share.fileId}`}
            className="flex items-center gap-3"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base text-text">{titleOf(share)}</span>
              <span className="block text-base text-text2">
                {share.kind && `${t(kindOf(share.kind).label)} · `}
                {left ? t('Expires {{when}}', { when: left }) : t('Expired')}
              </span>
            </span>
            <Button
              variant="pale"
              size="md"
              className="flex-none text-bad hover:text-bad"
              onClick={() => revoke(share.fileId)}
              testid={`settings-share-revoke-${share.fileId}`}
            >
              {t('Revoke')}
            </Button>
          </li>
        )
      })}
    </ul>
  )
}

// Every link still out there, and the way to take one back before its 24 hours
// are up. Only shown with Drive connected: without it there is nowhere a share
// could have been put, so there is nothing this row could ever list.
export default function SharesRow() {
  const { t } = useTranslation()

  return (
    <ExpandableRow
      label={t('Shared links')}
      description={t('Links you have sent out, until they expire or you revoke them')}
      action={t('Show')}
      testid="settings-shares-row"
    >
      <Shares />
    </ExpandableRow>
  )
}
