import { useMemo } from 'react'
import type { EntryMeta } from '@/lib/commands'
import { useStore } from '@/store'
import { t } from '@/i18n'
import { rank, searchEntries } from './search'
import { useCommands, type Command } from './commands'

export type Item =
  | { kind: 'entry'; key: string; entry: EntryMeta }
  | { kind: 'command'; key: string; command: Command }

export interface Group {
  label: string
  items: Item[]
}

// The palette is a shortcut, not a browser — a long entry list belongs in the
// list column, so only the strongest handful surface here.
const MAX_ENTRIES = 6

const entryItem = (entry: EntryMeta): Item => ({ kind: 'entry', key: `entry:${entry.id}`, entry })

const commandItem = (command: Command): Item => ({
  kind: 'command',
  key: `command:${command.id}`,
  command
})

const group = (label: string, items: Item[]): Group[] =>
  items.length === 0 ? [] : [{ label, items }]

// Splits the results into the prototype's sections: the top entry on its own,
// the runners-up, then the matching commands.
export const buildGroups = (
  entries: EntryMeta[],
  commands: Command[],
  query: string
): Group[] => {
  const matched = rank(commands, query, command => [{ text: command.label }])
  const [best, ...rest] = entries

  return [
    ...group(t('Best match'), best ? [entryItem(best)] : []),
    ...group(t('Entries'), rest.map(entryItem)),
    ...group(t('Commands'), matched.map(commandItem))
  ]
}

export const useResults = (query: string): Group[] => {
  const entries = useStore(state => state.entries.items)
  const commands = useCommands()

  // The only costly step (a sort plus a score per entry), so it is the only one
  // worth memoizing. With no query there is nothing to rank entries by, so the
  // palette opens on the command list alone.
  const matched = useMemo(
    () => (query.trim() === '' ? [] : searchEntries(entries, query).slice(0, MAX_ENTRIES)),
    [entries, query]
  )

  return buildGroups(matched, commands, query)
}
