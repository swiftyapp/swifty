import { useStore } from '@/store'
import { useShown } from '../../Body/Aside/Show/useShown'
import Read from '../Detail/Read'
import Editor from '../Form/Editor'
import Held from '../Form/Held'

/**
 * The phone's one entry screen — a row being read, a row being changed, or a
 * new one being written.
 *
 * One component for all three, the way the desktop's `Aside/Show` is one pane
 * for them: the decrypt lives here in a single `useShown`, so tapping Edit
 * changes which face is drawn and nothing else. Two screens each doing their
 * own reveal is what used to unmount the read view, re-decrypt, and leave an
 * empty frame up until the second reveal landed — or forever, if it failed.
 *
 * Writing wins over reading: editing an entry is both a selection and a draft,
 * and what it is is a form.
 */
export default function Entry() {
  // The kind being created, or null. An edit takes its kind from the entry.
  const type = useStore(state => state.entries.new)
  const editing = useStore(state => state.entries.edit)
  const selected = useStore(state => state.entries.current)
  // A draft is never handed the selection: it would inherit that entry's
  // in-flight reveal, and with it its id. (`newEntry` clears the selection, so
  // this only ever restates the intent — but it restates it where it matters.)
  const entry = type ? undefined : (selected ?? undefined)
  const { kindType, current, held } = useShown(entry, type ?? undefined)

  if (!kindType) return null

  if (type || editing) {
    // A draft has nothing to reveal, and coming from the read screen the
    // secrets are already in hand, so this is only the edit asked for before
    // the first reveal landed. It offers its own way out (see `Held`).
    if (held) return <Held entry={entry} type={kindType} />
    // Keyed per entry: each editing session starts from a fresh draft. A new
    // entry has no id to key on, so it is keyed by its kind — choosing another
    // kind (the picker again, or a scan that recognized a different one) is a
    // different draft, not the same one with other rows on it.
    return (
      <Editor
        key={entry?.id ?? `new-${kindType}`}
        entry={entry}
        type={kindType}
        revealed={current}
      />
    )
  }

  if (!entry) return null
  // Keyed per entry, so the next selection starts from a fresh screen rather
  // than one still holding the previous row's scroll and delete error.
  return <Read key={entry.id} entry={entry} revealed={current} />
}
