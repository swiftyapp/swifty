import {
  useStore,
  lockVault as lockVaultAction,
  newEntry,
  openSettings,
  setView,
  toggleTheme
} from '@/store'
import { t } from '@/i18n'
import { GearGlyph, LockGlyph, MoonGlyph, PlusGlyph, SunGlyph } from '../icons'

type Glyph = typeof LockGlyph

export interface Command {
  id: string
  label: string
  // Displayed hint only; the binding itself lives in `useShortcuts`.
  shortcut?: string
  glyph: Glyph
  run: () => void
}

// Locks the vault and drops back to the auth flow — the same path as the
// header's lock button.
export const lockVault = () => {
  void lockVaultAction()
}

// Starts a new entry, leaving the audit view first (it has no editor) — the
// same path as the rail's add button, including its interim rule that the kind
// comes from the active type filter until the kind picker lands.
export const startNewEntry = () => {
  const { filters, ui } = useStore.getState()
  if (ui.view === 'health') setView('items')
  newEntry(filters.type ?? 'login')
}

// The palette's fixed command list. Order here is the order shown for an empty
// query, and the tie-break when several commands score the same.
// Rebuilt on every render rather than memoized: four objects is cheaper than
// the dependency bookkeeping, and `t` reads a module-level locale that a
// dependency array can't see.
export const useCommands = (): Command[] => {
  const theme = useStore(state => state.theme)

  return [
    { id: 'new-entry', label: t('New entry'), glyph: PlusGlyph, run: startNewEntry },
    {
      id: 'lock-vault',
      label: t('Lock vault'),
      shortcut: '⌘L',
      glyph: LockGlyph,
      run: lockVault
    },
    {
      id: 'toggle-theme',
      label: t('Toggle theme'),
      glyph: theme === 'dark' ? SunGlyph : MoonGlyph,
      run: toggleTheme
    },
    { id: 'settings', label: t('Settings'), glyph: GearGlyph, run: openSettings }
  ]
}
