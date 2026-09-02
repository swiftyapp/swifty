import { useStore } from '@/store'
import { useVariant } from '../Empty/variant'
import { DetailEmpty } from '../Empty'
import Show from './Show'
import Audit from './Audit'

// Detail-pane content only. Create/edit no longer replaces it — the Form now
// renders in a right slide-in sheet over this pane (mounted by Body).
export default function Aside() {
  const entry = useStore(state => state.entries.current)
  const variant = useVariant()

  if (entry) return <Show entry={entry} />
  // No variant means the health view has a score to show; everything else the
  // pane can be showing is one kind of empty or another.
  if (!variant) return <Audit />
  return <DetailEmpty variant={variant} />
}
