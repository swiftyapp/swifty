import type { LoginEntry } from '@/lib/commands'
import Item from './Item'
import Totp from './Item/Totp'
import Tags from './Item/Tags'

interface Props {
  entry: LoginEntry
}

export default function Login({ entry }: Props) {
  return (
    <div className="entry-details">
      <Item name="Website" entry={entry} link />
      <Item name="Username" entry={entry} />
      <Item name="Password" entry={entry} secure />
      <Totp name="OTP" entry={entry} />
      <Item name="Email" entry={entry} />
      <Tags entry={entry} />
      <Item name="Note" entry={entry} />
    </div>
  )
}
