import { useStore } from '@/store'
import { useShown } from '../../Body/Aside/Show/useShown'
import Editor from './Editor'

/**
 * The form screen — a new entry, or an existing one being changed.
 *
 * Which it is comes from the store, not from a prop, exactly as the desktop's
 * `Aside` reads it. This file is only the gate: the decrypt, and the two keys
 * that decide when a fresh editing session begins. `Editor` does the writing.
 */
export default function Form() {
  const type = useStore(state => state.entries.new)
  const entry = useStore(state => state.entries.current)
  // A draft is never handed the selection: it would inherit that entry's
  // in-flight reveal, and with it its id. (`newEntry` clears the selection, so
  // this only ever restates the intent — but it restates it where it matters.)
  const subject = type ? undefined : (entry ?? undefined)
  const { kindType, current, held } = useShown(subject, type ?? undefined)

  if (!kindType) return null
  // Hold the screen's frame until the secrets are in hand — an editor seeded
  // from a reveal that has not landed would discard whatever is typed
  // meanwhile. A tombstone never gets here, so this always resolves.
  if (held) return <div className="min-h-0 flex-1 bg-detail" />
  // Keyed per entry: each session starts from a fresh draft. A new entry has no
  // id to key on, so it is keyed by its kind — choosing another kind (the
  // picker again, or a scan that recognized a different one) is a different
  // draft, not the same one with other rows on it.
  return (
    <Editor
      key={subject?.id ?? `new-${kindType}`}
      entry={subject}
      type={kindType}
      revealed={current}
    />
  )
}
