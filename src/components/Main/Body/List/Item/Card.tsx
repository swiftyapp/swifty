import type { CardEntry } from '@/lib/commands'
import Visa from '@/assets/images/cards/visa.svg?react'
import Master from '@/assets/images/cards/master.svg?react'
import CardIcon from '@/assets/images/cards/card.svg?react'

interface Props {
  entry: CardEntry
}

export default function Card({ entry }: Props) {
  const icon = () => {
    switch (entry.number[0]) {
      case '5':
        return <Master width="32" />
      case '4':
        return <Visa width="32" />
      default:
        return <CardIcon width="30" />
    }
  }

  return (
    <>
      <div className="icon">{icon()}</div>
      <div className="description">
        <div className="primary">{entry.title}</div>
      </div>
    </>
  )
}
