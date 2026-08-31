import { useState, type CSSProperties } from 'react'
import type { Entry } from '@/lib/commands'
import { t } from '@/i18n'
import { openLink } from '@/services/openLink'
import { CopyButton, IconButton, MONO_LABEL } from '../../../ui'
import { EyeGlyph, EyeOffGlyph } from '../../../../../icons'

interface Props {
  entry: Entry
  name: string
  link?: boolean
  cc?: boolean
  secure?: boolean
  big?: boolean
  children?: React.ReactNode
}

// A single detail row inside a login/card/note panel: a mono uppercase label, the
// (optionally secret) value, a reveal toggle for secure fields and a copy button.
export default function Item({ entry, name, link, cc, secure, big, children }: Props) {
  const [show, setShow] = useState(false)
  const raw =
    (entry as unknown as Record<string, string>)[name.toLowerCase()] ?? ''

  if (raw === '') return null

  // Secret rows mask the value in CSS (like the original) so the real text stays
  // in the DOM — the E2E smoke spec asserts the actual password/username text.
  const masked = secure && !show
  const maskStyle: CSSProperties = masked
    ? ({ WebkitTextSecurity: 'disc' } as CSSProperties)
    : {}
  const display = cc ? (raw.match(/.{1,4}/g)?.join(' ') ?? raw) : raw

  const value = () => {
    if (link)
      return (
        <a
          className="text-accent hover:underline"
          href={raw}
          onClick={e => {
            e.preventDefault()
            openLink(raw)
          }}
        >
          {raw}
        </a>
      )
    return display
  }

  return (
    <div className="item flex items-center gap-3 px-3.5 py-3 shadow-[inset_0_-1px_0_var(--c-line)] last:shadow-none">
      <span className={`w-24 flex-none ${MONO_LABEL}`}>{t(name)}</span>
      <span
        className={
          big
            ? 'min-w-0 flex-1 break-all font-mono text-xl tracking-secret text-text'
            : 'min-w-0 flex-1 break-all font-mono text-base text-text'
        }
        style={maskStyle}
        data-testid={`entry-value-${name.toLowerCase()}`}
      >
        {value()}
      </span>
      {children}
      {secure && (
        <IconButton
          title={show ? t('Hide') : t('Reveal')}
          active={show}
          onClick={() => setShow(!show)}
        >
          {show ? <EyeOffGlyph /> : <EyeGlyph />}
        </IconButton>
      )}
      <CopyButton value={raw} title={t('Copy')} />
    </div>
  )
}
