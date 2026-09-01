import { useState } from 'react'
import type { CardEntry } from '@/lib/commands'
import { cardBrandOf, hasBrandMark } from '@/utils/cardBrand'
import CardBrandMark from '@/components/elements/CardBrandMark'
import { useCopied } from '@/hooks/useCopied'
import { t } from '@/i18n'
import Tags from './Item/Tags'
import { EyeGlyph, EyeOffGlyph } from '../../../../icons'

interface Props {
  entry: CardEntry
}

const group = (value: string) => value.match(/.{1,4}/g)?.join(' ') ?? value

// One data point on the card face. The whole field is a click-to-copy target
// (the 1Password pattern — no per-field buttons, so the face stays a card,
// not a toolbar), with inline "Copied" feedback at the pointer. Copy always
// copies the true value, masked or not. No value renders an inert dash.
function Face({
  label,
  value,
  copyValue,
  testid
}: {
  label: string
  value: string
  copyValue?: string
  testid: string
}) {
  const { copied, copy } = useCopied()

  const body = (
    <>
      <div className="text-[11px] uppercase tracking-[0.12em] opacity-50">{label}</div>
      <div className="mt-1 text-[13px]" data-testid={testid}>
        {copied ? t('Copied') : copyValue ? value : '—'}
      </div>
    </>
  )
  if (!copyValue) return <div className="px-1.5 py-1">{body}</div>

  return (
    <button
      type="button"
      onClick={() => copy(copyValue)}
      title={t('Copy')}
      className="cursor-pointer rounded-sm px-1.5 py-1 text-left transition-colors hover:bg-white/10"
    >
      {body}
    </button>
  )
}

// The card IS the data surface: every value on it copies on click, and one
// eye reveals number/CVC/PIN together (the Apple Card "show details" model) —
// two interactions total, nothing else competing for attention.
export default function Card({ entry }: Props) {
  const [show, setShow] = useState(false)
  const { copied: numberCopied, copy: copyNumber } = useCopied()
  // Derived live from the revealed number (the list's stored slug isn't in
  // scope here, and this also tracks unsaved-but-revealed data correctly).
  const brand = cardBrandOf(entry.number)

  const number = entry.number
    ? show
      ? group(entry.number)
      : `•••• •••• •••• ${entry.number.slice(-4)}`
    : ''
  const expires =
    entry.month || entry.year ? `${entry.month || '••'}/${(entry.year || '••').slice(-2)}` : ''

  return (
    <div className="mt-3">
      {/* Card art: an always-dark plastic-card visual, deliberately off-system.
          Its gradient, hex inks, 16/4px radii and face letter-spacings imitate a
          real card, so they are exempt from the type/radius/tracking scales. */}
      <div className="relative flex h-[288px] w-[460px] flex-col overflow-hidden rounded-[16px] border border-line2 bg-[linear-gradient(150deg,#2A2D33,#14161A_62%)] p-6 font-mono text-[#EDEEF0] shadow-[0_18px_40px_rgba(0,0,0,0.32)]">
        <div className="absolute -right-10 -top-16 h-[240px] w-[240px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.07),transparent_70%)]" />
        <div className="relative flex items-start">
          <div className="flex-1 pt-1 text-[12px] uppercase tracking-[0.18em] opacity-60">
            {entry.name || t('Card')}
          </div>
          {hasBrandMark(brand) ? (
            <CardBrandMark brand={brand} size={22} tone="light" />
          ) : (
            <div className="h-7 w-[40px] rounded-[4px] border border-white/15 bg-white/10" />
          )}
        </div>
        <div className="flex-1" />
        {entry.number ? (
          <button
            type="button"
            onClick={() => copyNumber(entry.number)}
            title={t('Copy')}
            className="-mx-2 cursor-pointer self-start rounded-sm px-2 py-1 text-left text-[24px] tracking-[0.14em] transition-colors hover:bg-white/10"
            data-testid="entry-value-number"
          >
            {numberCopied ? t('Copied') : number}
          </button>
        ) : (
          <div className="px-0 py-1 text-[24px] tracking-[0.14em] opacity-50">
            •••• •••• •••• ••••
          </div>
        )}
        <div className="relative mt-5 flex items-end gap-5">
          <div className="-mx-1.5 flex min-w-0 flex-1 gap-3.5">
            <Face
              label={t('Holder')}
              value={entry.name}
              copyValue={entry.name || undefined}
              testid="entry-value-name"
            />
            <Face
              label={t('Expires')}
              value={expires}
              copyValue={expires || undefined}
              testid="entry-value-expires"
            />
            <Face
              label={t('CVC')}
              value={show ? entry.cvc : '•••'}
              copyValue={entry.cvc || undefined}
              testid="entry-value-cvc"
            />
            <Face
              label={t('Pin')}
              value={show ? entry.pin : '••••'}
              copyValue={entry.pin || undefined}
              testid="entry-value-pin"
            />
          </div>
          <button
            type="button"
            onClick={() => setShow(!show)}
            title={show ? t('Hide') : t('Reveal')}
            data-testid="card-reveal-button"
            className="grid h-7 w-7 flex-none cursor-pointer place-items-center rounded-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            {show ? <EyeOffGlyph /> : <EyeGlyph />}
          </button>
        </div>
      </div>
      <Tags entry={entry} />
    </div>
  )
}
