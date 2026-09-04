import { useTranslation } from 'react-i18next'
import type { SshKeyPair } from '@/lib/commands'
import { MONO_LABEL } from '@/components/elements/tokens'
import Line from './Line'
import Secret from './Secret'

interface Props {
  /** Null only for the moment before the first key comes back from Rust. */
  pair: SshKeyPair | null
  comment: string
  onComment: (comment: string) => void
}

// The dialog's SSH face: the three parts of a fresh ed25519 key, and the
// comment that labels the public line.
export default function Ssh({ pair, comment, onComment }: Props) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-3">
      <Line label="Public key" value={pair?.publicKey ?? ''} testid="generator-ssh-public" />
      <Line
        label="Fingerprint"
        value={pair?.fingerprint ?? ''}
        testid="generator-ssh-fingerprint"
      />
      <Secret value={pair?.privateKey ?? ''} />
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
