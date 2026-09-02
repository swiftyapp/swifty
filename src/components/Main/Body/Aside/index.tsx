import { useStore } from '@/store'
import { useVariant } from '../Empty/variant'
import { DetailEmpty } from '../Empty'
import Show from './Show'
import Audit from './Audit'

// Detail-pane content. Creating and editing happen right here, in the pane:
// `Show` renders the kind's fields either way, read or write.
export default function Aside() {
  // The kind being created, or null. An edit takes its kind from the entry.
  const draftType = useStore(state => state.entries.new)
  const editing = useStore(state => state.entries.edit)
  const entry = useStore(state => state.entries.current)
  const variant = useVariant()

  if (draftType) return <Show type={draftType} editing />
  if (entry) return <Show entry={entry} editing={editing} />
  // No variant means the health view has a score to show; everything else the
  // pane can be showing is one kind of empty or another.
  if (!variant) return <Audit />
  return <DetailEmpty variant={variant} />
}
