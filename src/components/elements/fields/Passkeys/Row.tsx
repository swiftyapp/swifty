import { useTranslation } from 'react-i18next'
import type { Passkey } from '@/lib/commands'
import { cx } from '@/utils/cx'
import { shortDate, toTime } from '@/utils/time'
import { KeyGlyph, TrashGlyph } from '../../../Main/icons'
import IconButton from '../../IconButton'
import { MONO_META, ROW_HAIRLINE } from '../../tokens'

interface Props {
  passkey: Passkey
  /** Editing only: drops this passkey from the draft. */
  onRemove?: () => void
}

// One passkey, in the list row's typography: the site it belongs to, then the
// account and when it was made. The site prefers `rpName` — the name the site
// gave itself — and falls back to the bare `rpId`, which is all a passkey is
// guaranteed to carry.
//
// What is deliberately absent: the private key, the user handle and the
// credential id. The first is the secret itself, and the other two are opaque
// blobs that identify the credential to the site and nothing at all to a
// person — so there is no reason for either to be on screen or on a clipboard.
export default function PasskeyRow({ passkey, onRemove }: Props) {
  const { t } = useTranslation()
  const created = toTime(passkey.createdAt)

  return (
    <div className={cx('flex items-center gap-3 px-3.5 py-3', ROW_HAIRLINE)}>
      <span className="flex-none text-text3">
        <KeyGlyph />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-base text-text">
          {passkey.rpName || passkey.rpId}
        </div>
        <div className={`mt-0.5 truncate ${MONO_META}`}>
          {passkey.userName}
          {created !== null &&
            ` · ${t('Created {{time}}', { time: shortDate(created) })}`}
        </div>
      </div>
      {onRemove && (
        <IconButton title={t('Remove passkey')} onClick={onRemove}>
          <TrashGlyph />
        </IconButton>
      )}
    </div>
  )
}
