import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { shareList, shareRevoke, type ActiveShare } from '@/api/share'
import { describeError } from '@/api/errors'
import { useVault } from '@/store'
import { revokeOrphans } from '@/services/shares'
import { kindOf } from '@/kinds'
import { useNow } from '@/hooks/useNow'
import { useLatestRequest } from '@/hooks/useLatestRequest'
import { relativeUntil } from '@/utils/time'
import { cx } from '@/utils/cx'
import Button from '@/components/elements/Button'
import { ROW_HAIRLINE } from '@/components/elements/tokens'
import { ChevronRightGlyph, LinkGlyph } from '../../../../icons'
import RowHead from './RowHead'

// How often the countdowns are re-read. A minute is the finest unit they show.
const TICK_MS = 60_000

// The list, mounted only while the row is unfolded — which is what makes the
// fetch happen on expand rather than on every visit to this pane.
function Shares() {
  const { t } = useTranslation()
  const entries = useVault(state => state.items)
  const [shares, setShares] = useState<ActiveShare[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const now = useNow(TICK_MS)

  // The one way the list is read, first time and every time after: what comes
  // back replaces what is shown, and a failure is shown in its place rather
  // than left behind a list that is no longer true. Reads can overlap — a slow
  // one from the last tick and a fresh one from this — so only the newest may
  // answer, or a stale page would undo a sweep the later one already saw.
  const begin = useLatestRequest()
  const load = useCallback(
    (read: () => Promise<ActiveShare[]>) => {
      const current = begin()
      read()
        .then(list => {
          if (!current()) return
          setShares(list)
          setError(null)
        })
        .catch(reason => current() && setError(describeError(reason)))
    },
    [begin]
  )

  // Shares an earlier dialog could not take back go first, so the list that
  // follows does not show a link that is about to be revoked anyway.
  useEffect(() => load(() => revokeOrphans().then(shareList)), [load])

  // A countdown that has run out while the row sat open: ask again rather
  // than show "Expired" for a file the backend's own sweep has since deleted.
  // While the read keeps failing this asks once per tick, and shows the
  // failure meanwhile; the first read that succeeds puts the list back.
  const expired = shares?.some(share => new Date(share.expiresAt).getTime() <= now) ?? false
  useEffect(() => {
    if (expired) load(shareList)
  }, [expired, now, load])

  // A share outlives the entry it was cut from: it is a copy, and deleting the
  // original neither revokes it nor gives it a title back.
  const titleOf = (share: ActiveShare) =>
    entries.find(entry => entry.id === share.entryId)?.title ?? t('Deleted entry')

  const revoke = (fileId: string) => {
    shareRevoke(fileId)
      .then(() => setShares(list => (list ?? []).filter(share => share.fileId !== fileId)))
      .catch(reason => setError(describeError(reason)))
  }

  if (error)
    return (
      <div data-testid="settings-shares-error" className="text-sm text-bad">
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
        const left = relativeUntil(share.expiresAt, now)
        return (
          <li
            key={share.fileId}
            data-testid={`settings-share-${share.fileId}`}
            className="flex items-center gap-3"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base text-text">{titleOf(share)}</span>
              <span className="block text-sm text-text2">
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
// could have been put, so there is nothing this row could ever list. The whole
// row is the disclosure — it has nothing else to press.
export default function SharesRow() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <div className={ROW_HAIRLINE}>
      <button
        type="button"
        data-testid="settings-shares-row"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-hover"
      >
        <RowHead
          icon={<LinkGlyph />}
          label={t('Shared links')}
          description={t("Links you've sent stay live until they expire or you revoke them")}
        />
        <ChevronRightGlyph
          className={cx('flex-none text-text2 transition-transform', open && 'rotate-90')}
        />
      </button>
      {/* Lines up under the label, past the tile, as SettingsRow's does. */}
      {open && (
        <div className="px-4 pb-3.5 pl-[62px]">
          <Shares />
        </div>
      )}
    </div>
  )
}
