import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { LABEL_TYPE } from '@/components/elements/tokens'
import { countryName } from '@/utils/countries'
import { DOC_TYPE_LABELS } from '../templates'
import { CARD_PALETTES, type CardType } from './palette'
import DocCell, { type Doc } from './DocCell'
import Frame from './Frame'
import Portrait from './Portrait'
import Reveal from './Reveal'
import { FOOT, HOLDER } from './layout'

interface Props {
  docType: CardType
  doc: Doc
}

/**
 * An ID-1 card — the wallet-sized document: ID card, driving licence,
 * residence permit, or whatever "other" is. Laid out the way they all are: a
 * coloured band naming the document and its country, the portrait at the left,
 * the holder beside it, the dates along the bottom.
 */
export default function Card({ docType, doc }: Props) {
  const { t } = useTranslation()
  const country = doc.value('country')
  const place = countryName(country) ?? country

  return (
    <Frame palette={CARD_PALETTES[docType]} aspect="aspect-[1.586]" docType={docType} className="flex-col">
      <header
        className="flex items-center justify-between gap-3 bg-(--face-band) px-5 py-2 text-(--face-band-ink)"
        style={{ '--face-hover': 'rgba(255, 255, 255, 0.12)' } as CSSProperties}
      >
        <span className={`truncate ${LABEL_TYPE}`}>
          {t(DOC_TYPE_LABELS[docType])}
          {place && ` · ${place}`}
        </span>
        <DocCell doc={doc} name="country" bare ink={`${LABEL_TYPE} font-medium`} className="flex-none" />
      </header>

      <div className="flex flex-1 gap-4 px-5 pt-4">
        <Portrait />
        <div className={HOLDER}>
          <DocCell
            doc={doc}
            name="name"
            ink="text-lg font-medium uppercase tracking-[0.03em]"
            wrap
            className="col-span-full"
          />
          <DocCell doc={doc} name="birth_date" />
          <DocCell doc={doc} name="sex" />
          <DocCell doc={doc} name="nationality" />
          <div className="col-span-full flex items-end gap-2">
            <DocCell doc={doc} name="number" ink="text-lg tracking-secret" wrap className="flex-1" />
            <Reveal shown={doc.shown} onToggle={doc.toggle} className="mb-1" />
          </div>
        </div>
      </div>

      <div className={`${FOOT} px-5 pb-4 pt-3`}>
        <DocCell doc={doc} name="issue_date" />
        <DocCell doc={doc} name="expiry_date" />
        <DocCell doc={doc} name="authority" />
        <DocCell doc={doc} name="personal_number" />
      </div>
    </Frame>
  )
}
