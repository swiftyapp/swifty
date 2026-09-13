import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import CopyButton from '@/components/elements/CopyButton'
import IconButton from '@/components/elements/IconButton'
import Panel from '@/components/elements/Panel'
import { useField } from '@/components/elements/fields'
import { LABEL, META } from '@/components/elements/tokens'
import { EyeGlyph, EyeOffGlyph, LockGlyph } from '@/components/Main/icons'
import { privateKeyFormat } from '../keyInfo'

// What stands in for the body while it is sealed. Fixed, like BLOCK_DOTS: the
// seal says nothing about how long the key is.
const SEAL = Array.from({ length: 4 }, () => '•'.repeat(64))

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
  const weight = [privateKeyFormat(value), t('{{size}} bytes', { size: value.length })]
    .filter(Boolean)
    .join(' · ')

  return (
    <Panel>
      <div className="flex items-center gap-2.5 px-3.5 py-3 inset-shadow-hairline">
        <span className={`flex-1 ${LABEL}`}>{t('Private key')}</span>
        <span className={`${META} truncate font-mono`}>{weight}</span>
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
        className="relative whitespace-pre-wrap break-all bg-field px-3.5 py-3 font-mono text-xs leading-[1.65] text-text2"
        data-testid="entry-value-privateKey"
      >
        {head && <div>{head}</div>}
        {shown ? (
          body.map((line, index) => <div key={index}>{line}</div>)
        ) : (
          <div aria-hidden className="select-none blur-[5px]">
            {SEAL.map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
        )}
        {foot && <div>{foot}</div>}

        {!shown && (
          <button
            type="button"
            onClick={() => setShown(true)}
            aria-label={t('Reveal')}
            data-testid="unseal-privateKey"
            className="absolute inset-0 grid cursor-pointer place-items-center"
          >
            <span className="flex h-[30px] items-center gap-2 rounded-sm border border-line2 bg-detail px-3 font-sans text-base font-medium text-text shadow-[0_6px_18px_rgba(0,0,0,0.12)]">
              <LockGlyph size={13} />
              {t('Sealed · click to reveal')}
            </span>
          </button>
        )}
      </div>
    </Panel>
  )
}
