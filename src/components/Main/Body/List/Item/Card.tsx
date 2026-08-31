import type { EntryMeta } from '@/lib/commands'
import CardIcon from '@/assets/images/cards/card.svg?react'

interface Props {
  entry: EntryMeta
}

// The card number is a secret (in the payload), so the list can't brand by
// issuer; a generic card icon is shown until the entry is revealed.
export default function Card({ entry }: Props) {
  return (
    <>
      <div className="icon">
        <CardIcon width="30" />
      </div>
      <div className="description">
        <div className="primary">{entry.title}</div>
      </div>
    </>
  )
}
