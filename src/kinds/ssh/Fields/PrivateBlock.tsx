import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import CopyButton from '@/components/elements/CopyButton'
import IconButton from '@/components/elements/IconButton'
import Panel from '@/components/elements/Panel'
import Seal from '@/components/elements/Seal'
import { useField } from '@/components/elements/fields'
import { LABEL, META } from '@/components/elements/tokens'
import { EyeGlyph, EyeOffGlyph } from '@/components/Main/icons'
import { privateKeyFormat } from '../keyInfo'

/**
 * The private key as a sealed block — the read view's. Its armor (the BEGIN and
 * END lines) stays legible with the format and weight in the head, and the body
 * is a blurred seal until the eye, or the seal itself, is pressed. The editor
 * keeps its textarea row (see PrivateKey).
 */
export default function PrivateBlock() {
  const { t } = useTranslation()
  const { value } = useField('privateKey')
  const [shown, setShown] = useState(false)

  if (value === '') return null

  const lines = value.trim().split('\n')
  const armored = lines.length >= 3 && lines[0].startsWith('-----BEGIN')
  const head = armored ? lines[0] : null
  const foot = armored ? lines[lines.length - 1] : null
  const body = armored ? lines.slice(1, -1) : lines
  // Bytes as the file would weigh, not code units: a pasted key can carry a
  // non-ASCII comment.
  const size = new TextEncoder().encode(value).length
  const weight = [privateKeyFormat(value), t('{{size}} bytes', { size })]
    .filter(Boolean)
    .join(' · ')

  return (
    // A flex column that grows: beside a plate taller than the rows, the block
    // takes the difference and its sealed body fills the panel (see `Read`).
    <Panel className="flex flex-1 flex-col">
      <div className="flex items-center gap-2.5 px-3.5 py-3 inset-shadow-hairline">
        <span className={`flex-1 ${LABEL}`}>{t('Private key')}</span>
        {/* `min-w-0`, or the flex item refuses to shrink and the header spills
            beside a narrow plate. */}
        <span className={`${META} min-w-0 truncate font-mono`}>{weight}</span>
        <IconButton
          title={shown ? t('Hide') : t('Reveal')}
          active={shown}
          testid="reveal-privateKey"
          onClick={() => setShown(!shown)}
        >
          {shown ? <EyeOffGlyph /> : <EyeGlyph />}
        </IconButton>
        <CopyButton value={value} title={t('Copy')} />
      </div>

      <div
        className="relative flex-1 whitespace-pre-wrap break-all bg-field px-3.5 py-3 font-mono text-xs leading-[1.65] text-text2"
        data-testid="entry-value-privateKey"
      >
        {head && <div>{head}</div>}
        {shown ? (
          body.map((line, index) => <div key={index}>{line}</div>)
        ) : (
          <Seal onReveal={() => setShown(true)} testid="unseal-privateKey" />
        )}
        {foot && <div>{foot}</div>}
      </div>
    </Panel>
  )
}
