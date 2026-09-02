import type { LoginEntry } from '@/lib/commands'
import Item from '@/components/Main/Body/Aside/Show/Details/Item'
import Totp from '@/components/Main/Body/Aside/Show/Details/Item/Totp'
import Tags from '@/components/Main/Body/Aside/Show/Details/Item/Tags'
import { Panel, StrengthBar } from '@/components/Main/Body/Aside/ui'

interface Props {
  entry: LoginEntry
}

export default function Details({ entry }: Props) {
  const hasOtp = !!entry.otp

  return (
    <div className="mt-3">
      <div
        className={
          hasOtp
            ? 'grid grid-cols-[minmax(0,1fr)_208px] items-start gap-3'
            : 'grid gap-3'
        }
      >
        <Panel>
          <Item name="Website" entry={entry} link />
          <Item name="Username" entry={entry} />
          <Item name="Password" entry={entry} secure big />
          {entry.password && (
            <div className="px-3.5 py-3 shadow-[inset_0_-1px_0_var(--c-line)] last:shadow-none">
              <StrengthBar password={entry.password} />
            </div>
          )}
          <Item name="Email" entry={entry} />
          <Item name="Note" entry={entry} />
        </Panel>
        {hasOtp && <Totp name="OTP" entry={entry} />}
      </div>
      <Tags entry={entry} />
    </div>
  )
}
