import { useTranslation } from 'react-i18next'
import { LABEL_TYPE } from '@/components/elements/tokens'
import { countryName } from '@/utils/countries'
import { DOC_TYPE_LABELS } from '../templates'
import { passportPalette } from './palette'
import DocCell, { type Doc } from './DocCell'
import Frame from './Frame'
import Portrait from './Portrait'
import Reveal from './Reveal'
import { FOOT, HOLDER } from './layout'

interface Props {
  doc: Doc
}

/**
 * A passport, open at the data page: ID-3 proportions, a strip of the cover
 * showing along the binding — in the colour the issuing country binds in, with
 * the word in gold — and the page itself laid out as they all are: the holder
 * beside the portrait, the document's own dates below.
 */
export default function Passport({ doc }: Props) {
  const { t } = useTranslation()
  const country = doc.value('country')
  const place = countryName(country) ?? country
  const label = t(DOC_TYPE_LABELS.passport)

  return (
    <Frame palette={passportPalette(country)} aspect="aspect-[1.42]" docType="passport">
      <aside className="flex w-11 flex-none flex-col items-center justify-between bg-(--face-band) py-4 text-(--face-band-ink)">
        {/* Bottom to top, the way a spine reads when the book lies face up. */}
        <span className={`rotate-180 [writing-mode:vertical-rl] ${LABEL_TYPE} tracking-[0.3em]`}>
          {label}
        </span>
        <span aria-hidden className="h-5 w-5 rounded-full border-[1.5px] border-current opacity-80" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col px-5 py-3">
        <header className="flex items-center justify-between gap-3 text-(--face-ink2)">
          <span className={`truncate ${LABEL_TYPE}`}>
            {label}
            {place && ` · ${place}`}
          </span>
          <DocCell
            doc={doc}
            name="country"
            bare
            ink={`${LABEL_TYPE} font-medium text-(--face-ink)`}
            className="flex-none"
          />
        </header>

        <div className="mt-3 flex flex-1 gap-4">
          <Portrait />
          <div className={HOLDER}>
            <DocCell
              doc={doc}
              name="name"
              ink="text-lg font-medium uppercase tracking-[0.03em]"
              wrap
              className="col-span-full"
            />
            <DocCell doc={doc} name="nationality" />
            <DocCell doc={doc} name="birth_date" />
            <DocCell doc={doc} name="sex" />
            <div className="col-span-full flex items-end gap-2">
              <DocCell doc={doc} name="number" ink="text-lg tracking-secret" wrap className="flex-1" />
              <Reveal shown={doc.shown} onToggle={doc.toggle} className="mb-1" />
            </div>
          </div>
        </div>

        <div className={`${FOOT} mt-3`}>
          <DocCell doc={doc} name="issue_date" />
          <DocCell doc={doc} name="expiry_date" />
          <DocCell doc={doc} name="authority" />
          <DocCell doc={doc} name="personal_number" />
        </div>
      </div>
    </Frame>
  )
}
