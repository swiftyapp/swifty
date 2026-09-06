import { useState } from 'react'
import { cardBrandOf, cardDigits, groupCardNumber, hasBrandMark } from '@/utils/cardBrand'
import CardBrandMark from '@/components/elements/CardBrandMark'
import Panel from '@/components/elements/Panel'
import { NoteField, useField, useFields } from '@/components/elements/fields'
import { useTranslation } from 'react-i18next'
import { EyeGlyph, EyeOffGlyph } from '@/components/Main/icons'
import { CARD_MASK } from '../meta'
import { formatExpiry, isExpired, splitExpiry } from '../expiry'
import Value from './Value'

export default function Fields() {
  const { t } = useTranslation()
  const { set, attempted } = useFields()
  const editing = !!set
  const [show, setShow] = useState(false)
  // Editing shows what is being typed; reading hides it until asked.
  const reveal = editing || show

  const name = useField('name')
  const number = useField('number')
  const cvc = useField('cvc')
  const pin = useField('pin')
  const month = useField('month')
  const year = useField('year')
  const note = useField('note')

  // The card is 460 wide whatever else there is, so the note goes in a column
  // of its own — and reading, an empty column is no column at all.
  const aside = editing || !!note.value
  const expired = !editing && isExpired(month.value, year.value)

  // Derived live from the number in hand, so it tracks an unsaved edit too.
  const brand = cardBrandOf(number.value)
  const grouped = groupCardNumber(number.value)
  const expiry = formatExpiry(month.value, year.value)
  const setExpiry = (typed: string) => {
    const parts = splitExpiry(typed)
    month.set(parts.month)
    year.set(parts.year)
  }

  return (
    <div
      // Compact has no room for the art and the rest of the fields side by
      // side, so below 768px the pair stacks instead.
      className={
        aside ? 'grid grid-cols-1 items-start gap-3 md:grid-cols-[460px_minmax(0,1fr)]' : undefined
      }
    >
      {/* Card art: an always-dark plastic-card visual, deliberately off-system.
          Its gradient, hex inks, 16/4px radii, unleaded type sizes and the
          number's wide letter-spacing imitate a real card, so they are exempt
          from the type/radius/tracking scales. */}
      <div className="relative flex h-[288px] w-[460px] max-w-full flex-col overflow-hidden rounded-[16px] border border-line2 bg-[linear-gradient(150deg,#2A2D33,#14161A_62%)] p-6 font-mono text-[#EDEEF0] shadow-[0_12px_28px_rgba(0,0,0,0.22)]">
        <div className="absolute -right-10 -top-16 h-[240px] w-[240px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.07),transparent_70%)]" />

        <div className="relative flex items-start justify-between gap-4">
          <Value
            name="name"
            display={name.value || t('Card')}
            copyValue={name.value}
            value={name.value}
            onChange={name.set}
            testid="entry-value-name"
            placeholder="Cardholder"
            maxLength={40}
            ink="text-[13px] uppercase tracking-label opacity-90"
            zone="top"
            className="-mx-1.5 flex-1"
          />
          {hasBrandMark(brand) ? (
            <CardBrandMark brand={brand} size={22} tone="light" />
          ) : (
            <div className="h-7 w-[40px] flex-none rounded-xs border border-white/15 bg-white/10" />
          )}
        </div>

        <div className="flex-1" />

        <Value
          name="number"
          display={
            number.value
              ? reveal
                ? grouped
                : `•••• •••• •••• ${cardDigits(number.value).slice(-4)}`
              : CARD_MASK
          }
          copyValue={number.value}
          value={grouped}
          onChange={next => number.set(cardDigits(next))}
          testid="entry-value-number"
          // Mask, not real catalog copy — it has no translation and falls
          // through to itself.
          placeholder={CARD_MASK}
          required
          maxLength={23}
          // A shrunk card cannot hold 19 glyphs at 24px; below 768px it steps
          // down a tier so the number still fits its plastic.
          ink="text-[19px] tracking-[0.14em] md:text-[24px]"
          className="-mx-1.5 self-stretch"
        />

        {/* Three equal columns on the number's width, plus the reveal's slot —
            held open while editing too, so the row is the same in both modes.
            The slot is 28 + the 6px the -mx pulls in, so the eye sits on the
            card's padding edge like the brand mark above it. */}
        <div className="relative -mx-1.5 mt-5 grid grid-cols-[repeat(3,minmax(0,1fr))_34px] items-end gap-3.5">
          <Value
            name="expiry"
            label="Expires"
            display={expiry || '••/••'}
            copyValue={expiry}
            value={expiry}
            onChange={setExpiry}
            testid="entry-value-expires"
            placeholder="MM/YY"
            required
            // One box, two draft keys: "12" fills the box but not the pair,
            // and `isValid` wants both — so the box has to say so itself.
            invalid={attempted && !(month.value && year.value)}
            maxLength={5}
            ink="text-[13px]"
            flag={
              expired && (
                <span className="flex-none text-[10px] uppercase tracking-label text-[#FF8A8A]">
                  {t('Expired')}
                </span>
              )
            }
          />
          <Value
            name="cvc"
            label="CVC"
            display={reveal ? cvc.value : '•••'}
            copyValue={cvc.value}
            value={cvc.value}
            onChange={next => cvc.set(cardDigits(next))}
            testid="entry-value-cvc"
            // Mask, not real catalog copy — falls through to itself.
            placeholder="•••"
            required
            maxLength={4}
            ink="text-[13px]"
          />
          <Value
            name="pin"
            label="Pin"
            display={reveal ? pin.value : '••••'}
            copyValue={pin.value}
            value={pin.value}
            onChange={next => pin.set(cardDigits(next))}
            testid="entry-value-pin"
            // Mask, not real catalog copy — falls through to itself.
            placeholder="••••"
            maxLength={6}
            ink="text-[13px]"
          />
          {!editing && (
            <button
              type="button"
              onClick={() => setShow(!show)}
              title={show ? t('Hide') : t('Reveal')}
              data-testid="card-reveal-button"
              className="mr-1.5 grid h-7 w-7 cursor-pointer place-items-center justify-self-end rounded-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              {show ? <EyeOffGlyph /> : <EyeGlyph />}
            </button>
          )}
        </div>
      </div>

      {aside && (
        <Panel>
          <NoteField label="Note" />
        </Panel>
      )}
    </div>
  )
}
