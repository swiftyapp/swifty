import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import CopyButton from '@/components/elements/CopyButton'
import IconButton from '@/components/elements/IconButton'
import Panel from '@/components/elements/Panel'
import Seal from '@/components/elements/Seal'
import { useField } from '@/components/elements/fields'
import { LABEL } from '@/components/elements/tokens'
import { EyeGlyph, EyeOffGlyph } from '@/components/Main/icons'

/**
 * The note body as a sealed block — the read view's. The body is the entry's
 * one secret (see meta.ts), so it stays a blurred seal until the eye, or the
 * seal itself, is pressed, as the SSH private key does. The editor keeps its
 * textarea (see index).
 */
export default function Read() {
  const { t } = useTranslation()
  const { value } = useField('note')
  const [shown, setShown] = useState(false)

  return (
    <Panel>
      <div className="flex items-center gap-2.5 px-3.5 py-3 inset-shadow-hairline">
        <span className={`flex-1 ${LABEL}`}>{t('Note')}</span>
        <IconButton
          title={shown ? t('Hide') : t('Reveal')}
          active={shown}
          testid="reveal-note"
          onClick={() => setShown(!shown)}
        >
          {shown ? <EyeOffGlyph /> : <EyeGlyph />}
        </IconButton>
        <CopyButton value={value} title={t('Copy')} />
      </div>

      <div
        className="relative whitespace-pre-wrap break-words bg-field px-3.5 py-3 text-base leading-relaxed text-text2"
        data-testid="entry-value-note"
      >
        {shown ? value : <Seal onReveal={() => setShown(true)} testid="unseal-note" />}
      </div>
    </Panel>
  )
}
