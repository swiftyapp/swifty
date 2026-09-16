import type { ReactNode } from 'react'
import { useUi, setView, type View } from '@/store'
import RailButton from '@/components/elements/RailButton'

// One rail tile per `ui.view`. Every view button is the same button — which one
// is lit is the only thing that differs — so they share this instead of a file
// each.
export default function ViewButton({
  view,
  label,
  testid,
  children
}: {
  view: View
  label: string
  testid: string
  children: ReactNode
}) {
  const selected = useUi(state => state.view === view)

  return (
    <RailButton label={label} selected={selected} onClick={() => setView(view)} testid={testid}>
      {children}
    </RailButton>
  )
}
