import { useState } from 'react'
import { cardBrandOf, cardDigits, groupCardNumber, hasBrandMark } from '@/utils/cardBrand'
import CardBrandMark from '@/components/elements/CardBrandMark'
import { TagsField, useField, useFields } from '@/components/elements/fields'
import { t } from '@/i18n'
import { EyeGlyph, EyeOffGlyph } from '@/components/Main/icons'
import { CARD_MASK } from '../meta'
import { formatExpiry, splitExpiry } from '../expiry'
import Value from './Value'

export default function Fields() {
  const { set } = useFields()
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
    <>
      {/* Card art: an always-dark plastic-card visual, deliberately off-system.
          Its gradient, hex inks, 16/4px radii and face letter-spacings imitate a
          real card, so they are exempt from the type/radius/tracking scales. */}
      <div className="relative flex h-[288px] w-[460px] flex-col overflow-hidden rounded-[16px] border border-line2 bg-[linear-gradient(150deg,#2A2D33,#14161A_62%)] p-6 font-mono text-[#EDEEF0] shadow-[0_18px_40px_rgba(0,0,0,0.32)]">
        <div className="absolute -right-10 -top-16 h-[240px] w-[240px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.07),transparent_70%)]" />

        <div className="relative flex items-start justify-between gap-4">
          <Value
            name="name"
            display={name.value || t('Card')}
            copyValue={name.value}
            value={name.value}
            onChange={name.set}
            testid="entry-value-name"
            placeholder={t('Cardholder')}
            maxLength={40}
            ink="text-[12px] uppercase tracking-[0.18em] opacity-60"
            zone="top"
            className="-mx-1.5 flex-1"
          />
          {hasBrandMark(brand) ? (
            <CardBrandMark brand={brand} size={22} tone="light" />
          ) : (
            <div className="h-7 w-[40px] flex-none rounded-[4px] border border-white/15 bg-white/10" />
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
          placeholder={CARD_MASK}
          required
          maxLength={23}
          ink="text-[24px] tracking-[0.14em]"
          className="-mx-2 self-stretch"
        />

        <div className="relative mt-5 flex items-end gap-5">
          <div className="-mx-1.5 flex min-w-0 flex-1 gap-3.5">
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
              maxLength={5}
              ink="text-[13px]"
            />
            <Value
              name="cvc"
              label="CVC"
              display={reveal ? cvc.value : '•••'}
              copyValue={cvc.value}
              value={cvc.value}
              onChange={next => cvc.set(cardDigits(next))}
              testid="entry-value-cvc"
              placeholder="•••"
              required
              maxLength={4}
              ink="text-[13px]"
            />
          </div>
          <Value
            name="pin"
            label="Pin"
            display={reveal ? pin.value : '••••'}
            copyValue={pin.value}
            value={pin.value}
            onChange={next => pin.set(cardDigits(next))}
            testid="entry-value-pin"
            placeholder="••••"
            maxLength={6}
            ink="text-[13px]"
            className="w-[72px] flex-none"
          />
          {!editing && (
            <button
              type="button"
              onClick={() => setShow(!show)}
              title={show ? t('Hide') : t('Reveal')}
              data-testid="card-reveal-button"
              className="grid h-7 w-7 flex-none cursor-pointer place-items-center rounded-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              {show ? <EyeOffGlyph /> : <EyeGlyph />}
            </button>
          )}
        </div>
      </div>
      <TagsField />
    </>
  )
}
