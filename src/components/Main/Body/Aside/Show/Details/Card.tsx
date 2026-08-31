import { useState } from 'react'
import type { CardEntry } from '@/lib/commands'
import { t } from '@/i18n'
import Item from './Item'
import Tags from './Item/Tags'
import { Panel, IconButton } from '../../ui'
import { EyeGlyph, EyeOffGlyph } from '../../../../icons'

interface Props {
  entry: CardEntry
}

const group = (value: string) => value.match(/.{1,4}/g)?.join(' ') ?? value

export default function Card({ entry }: Props) {
  const [show, setShow] = useState(false)

  const number = entry.number
    ? show
      ? group(entry.number)
      : `•••• •••• •••• ${entry.number.slice(-4)}`
    : '•••• •••• •••• ••••'
  const cvv = entry.cvc ? (show ? entry.cvc : '•••') : '—'
  const expires =
    entry.month || entry.year ? `${entry.month || '••'}/${(entry.year || '••').slice(-2)}` : '—'

  return (
    <div className="mt-3">
      <div className="grid grid-cols-[340px_minmax(0,1fr)] items-start gap-3.5">
        <div className="relative flex h-[208px] flex-col overflow-hidden rounded-2xl border border-line2 bg-[linear-gradient(150deg,#2A2D33,#14161A_62%)] p-[18px] text-[#EDEEF0] shadow-[0_18px_40px_rgba(0,0,0,0.32)]">
          <div className="absolute -right-10 -top-16 h-[200px] w-[200px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.07),transparent_70%)]" />
          <div className="flex items-start">
            <div className="flex-1 font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">
              {entry.name || t('Card')}
            </div>
            <div className="h-6 w-[34px] rounded border border-white/15 bg-white/10" />
          </div>
          <div className="flex-1" />
          <div className="font-mono text-[20px] tracking-[0.16em]">{number}</div>
          <div className="mt-4 flex gap-6 font-mono text-[11px]">
            <div>
              <div className="uppercase tracking-[0.12em] opacity-50">{t('Holder')}</div>
              <div className="mt-1 text-[12px]">{entry.name || '—'}</div>
            </div>
            <div>
              <div className="uppercase tracking-[0.12em] opacity-50">{t('Expires')}</div>
              <div className="mt-1 text-[12px]">{expires}</div>
            </div>
            <div>
              <div className="uppercase tracking-[0.12em] opacity-50">{t('CVC')}</div>
              <div className="mt-1 text-[12px]">{cvv}</div>
            </div>
          </div>
        </div>

        <Panel>
          <div className="flex items-center gap-3 px-3.5 py-3 shadow-[inset_0_-1px_0_var(--c-line)]">
            <span className="flex-1 text-[12px] text-text2">
              {t('Reveal number & CVC')}
            </span>
            <IconButton
              title={show ? t('Hide') : t('Reveal')}
              active={show}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOffGlyph /> : <EyeGlyph />}
            </IconButton>
          </div>
          <Item name="Number" entry={entry} cc secure />
          <Item name="Month" entry={entry} />
          <Item name="Year" entry={entry} />
          <Item name="CVC" entry={entry} secure />
          <Item name="Pin" entry={entry} secure />
          <Item name="Name" entry={entry} />
        </Panel>
      </div>
      <Tags entry={entry} />
    </div>
  )
}
