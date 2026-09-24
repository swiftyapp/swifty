import { PANE_PAD } from '@/components/elements/tokens'
import Aside from './Aside'

// The inset is not a prop: `DetailEmpty` undoes it with PANE_BLEED, so a pane
// padded any other way would put the empty surface off its own edges.
export default function DetailPane() {
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-detail text-text ${PANE_PAD}`}
    >
      <Aside />
    </div>
  )
}
