import { useStore } from '@/store'
import Read from './Read'
import Writing from './Writing'

/**
 * The pushed screen — an entry being read, written or created.
 *
 * Which of the two it is comes from the store, not from a prop: `entries.edit`
 * and `entries.new` are checked first because editing an entry is both, and
 * what it is is a form.
 */
export default function Detail() {
  const writing = useStore(state => state.entries.edit || state.entries.new !== null)
  const entry = useStore(state => state.entries.current)

  if (writing) return <Writing />
  if (!entry) return null
  // Keyed per entry, so the next selection starts from a fresh reveal rather
  // than a screen still holding the previous one's secrets.
  return <Read key={entry.id} entry={entry} />
}
