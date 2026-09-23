import {
  usePrefs,
  lockVault,
  openAddPicker,
  openGenerator,
  openSettings,
  startEntry,
  toggleTheme
} from '@/store'
import { KINDS, addLabel } from '@/kinds'
import { t } from '@/i18n'
import { chord } from '@/lib/platform'
import { DicesGlyph, GearGlyph, LockGlyph, MoonGlyph, PlusGlyph, SunGlyph } from '../icons'

type Glyph = typeof LockGlyph

export interface Command {
  id: string
  label: string
  // Displayed hint only; the binding itself lives in `useShortcuts`.
  shortcut?: string
  glyph: Glyph
  run: () => void
}

// The palette's fixed command list. Order here is the order shown for an empty
// query, and the tie-break when several commands score the same. The per-kind
// commands come first and skip the picker: someone who already knows what they
// are saving should not be asked.
// Rebuilt on every render rather than memoized: a handful of objects is cheaper
// than the dependency bookkeeping, and `t` reads a module-level locale that a
// dependency array can't see.
export const useCommands = (): Command[] => {
  const theme = usePrefs(state => state.theme)

  return [
    ...KINDS.map(kind => ({
      id: `new-${kind.type}`,
      label: addLabel(kind.type),
      glyph: kind.Glyph,
      run: () => startEntry(kind.type)
    })),
    {
      id: 'add-secret',
      label: t('Add a secret'),
      shortcut: chord('N'),
      glyph: PlusGlyph,
      run: openAddPicker
    },
    {
      id: 'generate-password',
      label: t('Generate a password'),
      shortcut: chord('G'),
      glyph: DicesGlyph,
      // The standalone form: nothing to apply the value to, so it copies.
      run: () => openGenerator()
    },
    {
      id: 'lock-vault',
      label: t('Lock vault'),
      shortcut: chord('L'),
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
