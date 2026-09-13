import { CARD, ROW_HAIRLINE } from '@/components/elements/tokens'
import { CheckGlyph } from '@/components/Main/icons'

interface Props {
  items: string[]
}

// What you get, one hairline-separated row each. A list rather than a
// paragraph: these are three independent promises, and the body above has
// already said the one thing that needs a sentence.
export default function BenefitsCard({ items }: Props) {
  return (
    <div className={CARD}>
      {items.map(item => (
        <div
          key={item}
          className={`flex items-center gap-2.5 px-3.5 py-2.5 text-left ${ROW_HAIRLINE}`}
        >
          <span className="flex-none text-good">
            <CheckGlyph size={14} />
          </span>
          <span className="flex-1 text-base text-text2">{item}</span>
        </div>
      ))}
    </div>
  )
}
