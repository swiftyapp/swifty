import { useTranslation } from 'react-i18next'
import { useCopied } from '@/hooks/useCopied'
import Paper from '@/components/elements/Face'
import { useField } from '@/components/elements/fields'
import { LABEL_TYPE } from '@/components/elements/tokens'
import { CheckGlyph, CopyGlyph } from '@/components/Main/icons'
import { randomart } from '@/utils/randomart'
import { keyLabel, parsePublicKey } from '../keyInfo'

/**
 * The fingerprint as the physical object — the read view's face of an SSH key.
 *
 * What ssh-keygen prints for a key, set on a plate: the randomart, so the key
 * is recognised at a glance, and the digest under it, which a click copies. The
 * chip names the algorithm and size, read off the public line. Reading only:
 * the fingerprint is never typed, so the editor keeps its plain row.
 */
export default function Face() {
  const { t } = useTranslation()
  const { copied, copy } = useCopied()
  const fingerprint = useField('fingerprint').value.trim()
  const info = parsePublicKey(useField('publicKey').value)

  const art = randomart(fingerprint, keyLabel(info))
  const chip = keyLabel(info, ' · ')
  // "SHA256:…" — the hash names the caption; a fingerprint in another form
  // (an import's hex MD5) is shown whole with no caption to give it.
  const colon = fingerprint.indexOf(':')
  const hash = colon > 0 ? fingerprint.slice(0, colon) : ''
  const digest = colon > 0 ? fingerprint.slice(colon + 1) : fingerprint

  return (
    // The vault's shared face (see elements/Face) in its slate tone, which
    // follows the theme where a document's paper does not. Its own `@container`:
    // below 200px the plate draws in — tighter padding, the art a tier down — so
    // the 19-column picture still fits at the 160px floor its column can shrink
    // to (see `Read`). A flex column, because the grid stretches it to the rows'
    // height: the label stays at the head and the digest at the foot, and the
    // art takes the middle, whatever is left of it.
    <Paper
      tone="slate"
      data-testid="ssh-face"
      className="@container flex flex-col p-5 @max-[200px]:p-4"
    >
      {/* Wraps rather than clips: on a narrow plate the chip drops under the label. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`flex-1 ${LABEL_TYPE} text-(--face-ink2)`}>{t('Fingerprint')}</span>
        {chip && (
          <span className="rounded-xs border border-(--face-rule) px-1.5 py-0.5 font-mono text-2xs tracking-label text-(--face-ink2)">
            {chip}
          </span>
        )}
      </div>

      {/* The middle: the art centred in whatever height the rows leave it. */}
      <div className="flex flex-1 items-center py-4">
        {art && (
          <div
            aria-hidden
            className="overflow-hidden whitespace-pre font-mono text-xs leading-[1.4] tracking-[0.02em] @max-[200px]:text-2xs"
          >
            {art.map((row, index) => (
              <div key={index}>{row}</div>
            ))}
          </div>
        )}
      </div>

      {hash && (
        <div className="text-2xs uppercase tracking-label text-(--face-ink2)">{hash}</div>
      )}
      <button
        type="button"
        onClick={() => copy(fingerprint)}
        title={t('Copy')}
        aria-label={`${t('Fingerprint')} · ${t('Copy')}`}
        className="group relative -mx-1.5 mt-1 flex cursor-pointer items-start gap-2 rounded-sm px-1.5 py-0.5 text-left transition-colors hover:bg-(--face-hover)"
      >
        <span
          className="min-w-0 flex-1 break-all font-mono text-xs leading-[1.5]"
          data-testid="entry-value-fingerprint"
        >
          {digest}
        </span>
        <span className="flex-none pt-px text-(--face-ink2)">
          {copied ? (
            <CheckGlyph size={12} />
          ) : (
            <CopyGlyph size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </span>
      </button>
    </Paper>
  )
}
