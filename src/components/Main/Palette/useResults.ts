import { rank } from './search'
import { useCommands, type Command } from './commands'

// The commands matching `query`, best first. Entries are not in here: the list
// column's search field already spans every kind and shows a full scrollable
// result list, so the palette is for commands alone.
//
// Not memoized: scoring a dozen labels costs less than the dependency
// bookkeeping would, and `t` reads a module-level locale a dependency array
// cannot see.
export const useResults = (query: string): Command[] =>
  rank(useCommands(), query, command => [{ text: command.label }])
