import { useStore } from '@/store'
import Read from './Read'

/**
 * The pushed screen for reading one entry. Writing is its own screen
 * (`Compact/Form`), which the shell prefers over this one — editing an entry is
 * both a selection and a draft, and what it is is a form.
 */
export default function Detail() {
  const entry = useStore(state => state.entries.current)

  if (!entry) return null
  // Keyed per entry, so the next selection starts from a fresh reveal rather
  // than a screen still holding the previous one's secrets.
  return <Read key={entry.id} entry={entry} />
}
