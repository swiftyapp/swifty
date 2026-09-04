import { useTranslation } from 'react-i18next'
import type { SshKeyPair } from '@/lib/commands'
import Button from '@/components/elements/Button'
import { MONO_LABEL } from '@/components/elements/tokens'
import { cx } from '@/utils/cx'
import Line from './Line'
import Secret from './Secret'

interface Props {
  /** Null before the first key comes back from Rust, and after a failed draw. */
  pair: SshKeyPair | null
  /** A draw is in flight; the pair on screen is the one being replaced. */
  pending: boolean
  /** The last draw failed; `onRetry` asks again. */
  error: boolean
  onRetry: () => void
  comment: string
  onComment: (comment: string) => void
}

// The dialog's SSH face: the three parts of a fresh ed25519 key, and the
// comment that labels the public line.
export default function Ssh({ pair, pending, error, onRetry, comment, onComment }: Props) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-3">
      {error ? (
        <div
          data-testid="generator-ssh-error"
          className="flex items-center gap-3 rounded-lg border border-line2 bg-field px-3 py-2.5"
        >
          <div className="flex-1 font-mono text-xs tracking-label text-bad">
            {t('Could not generate a key.')}
          </div>
          <Button size="md" variant="ghost" testid="generator-ssh-retry" onClick={onRetry}>
            {t('Try again')}
          </Button>
        </div>
      ) : (
        // Dimmed while a replacement is on its way, so the old key does not
        // read as the one about to be saved.
        <div
          data-testid="generator-ssh-key"
          aria-busy={pending}
          className={cx('grid gap-3 transition-opacity', pending && 'opacity-50')}
        >
          <Line label="Public key" value={pair?.publicKey ?? ''} testid="generator-ssh-public" />
          <Line
            label="Fingerprint"
            value={pair?.fingerprint ?? ''}
            testid="generator-ssh-fingerprint"
          />
          <Secret value={pair?.privateKey ?? ''} />
        </div>
      )}
      <div>
        <label htmlFor="generator-ssh-comment" className={MONO_LABEL}>
          {t('Comment')}
        </label>
        <input
          id="generator-ssh-comment"
          name="comment"
          value={comment}
          maxLength={64}
          autoComplete="off"
          spellCheck={false}
          placeholder="alice@laptop"
          data-testid="generator-ssh-comment"
          onChange={event => onComment(event.target.value)}
          className="mt-1 block h-9 w-full rounded-lg border border-line2 bg-field px-3 font-mono text-base text-text outline-none transition-colors placeholder:text-text3 focus:border-accent-line"
        />
      </div>
    </div>
  )
}
