import { useTranslation } from 'react-i18next'
import { useCopied } from '@/hooks/useCopied'
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
    <div
      data-testid="ssh-face"
      className="relative overflow-hidden rounded-[16px] bg-plate p-5 text-plate-ink shadow-plate"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[60px] -top-[80px] h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle,var(--plate-glow),transparent_70%)]"
      />

      <div className="relative flex items-center gap-2">
        <span className={`flex-1 ${LABEL_TYPE} text-plate-ink2`}>{t('Fingerprint')}</span>
        {chip && (
          <span className="rounded-xs border border-plate-rule px-1.5 py-0.5 font-mono text-2xs tracking-label text-plate-ink2">
            {chip}
          </span>
        )}
      </div>

      {art && (
        <div
          aria-hidden
          className="relative mt-4 overflow-hidden whitespace-pre font-mono text-xs leading-[1.4] tracking-[0.02em]"
        >
          {art.map((row, index) => (
            <div key={index}>{row}</div>
          ))}
        </div>
      )}

      {hash && (
        <div className="relative mt-4 text-2xs uppercase tracking-label text-plate-ink2">
          {hash}
        </div>
      )}
      <button
        type="button"
        onClick={() => copy(fingerprint)}
        title={t('Copy')}
        aria-label={`${t('Fingerprint')} · ${t('Copy')}`}
        className="group relative -mx-1.5 mt-1 flex cursor-pointer items-start gap-2 rounded-sm px-1.5 py-0.5 text-left transition-colors hover:bg-plate-hover"
      >
        <span
          className="min-w-0 flex-1 break-all font-mono text-xs leading-[1.5]"
          data-testid="entry-value-fingerprint"
        >
          {digest}
        </span>
        <span className="flex-none pt-px text-plate-ink2">
          {copied ? (
            <CheckGlyph size={12} />
          ) : (
            <CopyGlyph size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </span>
      </button>
    </div>
  )
}
