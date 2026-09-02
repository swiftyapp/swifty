import { useState } from 'react'
import type { EntryType } from '@/lib/commands'
import { syncImport } from '@/lib/commands'
import {
  useStore,
  openAddPicker,
  openSettings,
  startEntry,
  setFilterQuery,
  setFilterType
} from '@/store'
import { addLabel, kindOf } from '@/kinds'
import { t } from '@/i18n'
import Logo from '@/assets/images/logo.svg?react'
import EmptyState from '@/components/elements/EmptyState'
import { ActivityGlyph, SearchGlyph, StarGlyph, TrashGlyph } from '../../icons'

// The brand mark at whatever size the surface asks for — the same baked logo
// the rail shows, so the empty vault and the open one read as one character.
// `fill-current` overrides the file's baked ink so the mark takes the text
// colour of whatever tile it sits in.
const Mark = ({ size }: { size: number }) => (
  <Logo width={size} height={size} className="fill-current" aria-hidden="true" />
)

// The accelerators an empty pane can advertise. The name doubles as the copy
// key, and `hints()` resolves it at render so a locale switch retranslates.
const HINT = {
  browse: '↑↓',
  copy: '⏎',
  search: '⌘F',
  add: '⌘N',
  commands: '⌘K'
} as const

const hints = (...names: (keyof typeof HINT)[]) =>
  names.map(name => ({ keys: HINT[name], label: t(name) }))

// First run — the one hero in the app. Nothing exists yet, so this is the only
// thing on screen worth looking at and it gets the full treatment.
export function VaultEmpty() {
  const syncEnabled = useStore(state => state.sync.enabled)
  const [importing, setImporting] = useState(false)

  // On success the restored entries replace this screen; on failure the button
  // has to come back, or it spins forever.
  const restore = () => {
    setImporting(true)
    syncImport().catch(() => setImporting(false))
  }

  return (
    <EmptyState
      testid="empty-vault"
      mark={<Mark size={30} />}
      title={t('Your vault is empty')}
      body={t('Add your first login, card or note. Everything is encrypted before it touches disk.')}
      primary={{
        label: t('Add a secret'),
        onClick: openAddPicker,
        testid: 'create-first-entry-button'
      }}
      secondary={
        syncEnabled
          ? { label: t('Restore from Google Drive'), onClick: restore, loading: importing }
          : { label: t('Import from another app'), onClick: openSettings }
      }
      hints={hints('add', 'commands')}
    />
  )
}

// The vault has entries and none is open. Deliberately quiet — no tile, no
// body, no buttons: the hero treatment belongs to the empty vault alone, and
// this state is one arrow key away from real content.
export function SelectEmpty() {
  return (
    <EmptyState
      testid="empty-select"
      mark={<Mark size={28} />}
      markClassName="bg-transparent text-text3"
      titleClassName="text-text2"
      title={t('Select an item')}
      hints={hints('browse', 'copy', 'search', 'add', 'commands')}
    />
  )
}

// Vault Health with no password to score yet.
export function HealthEmpty() {
  return (
    <EmptyState
      testid="empty-health"
      mark={<ActivityGlyph size={28} />}
      title={t('Nothing to audit yet')}
      body={t('Your score appears once a login with a password is saved.')}
      primary={{ label: addLabel('login'), onClick: () => startEntry('login') }}
    />
  )
}

// One kind filtered down to nothing. Compact: the list column keeps its own
// header and rows above, so this is a line of text, not a scene.
export function FavoritesEmpty() {
  return (
    <EmptyState
      testid="empty-favorites"
      mark={<StarGlyph size={28} />}
      title={t('No favorites yet')}
      body={t('Star an entry to keep it here.')}
    />
  )
}

export function TrashEmpty() {
  return (
    <EmptyState
      testid="empty-trash"
      mark={<TrashGlyph size={28} />}
      title={t('Nothing in the trash')}
      body={t('Deleted entries wait here until you restore them or delete them for good.')}
    />
  )
}

export function KindEmpty({ type }: { type: EntryType }) {
  const { Glyph, pluralLabel } = kindOf(type)

  return (
    <EmptyState
      compact
      testid="empty-kind"
      mark={<Glyph />}
      title={t('No {kind} yet').replace('{kind}', t(pluralLabel))}
      primary={{ label: addLabel(type), onClick: () => startEntry(type), testid: 'empty-kind-add' }}
    />
  )
}

// A query that matched nothing, naming the query back so it's obvious why the
// list is blank. The kind filter, when one is on, is the other half of the why.
export function SearchEmpty({ query, type }: { query: string; type: EntryType | null }) {
  const title = type
    ? t('No matches for “{query}” in {kind}').replace('{kind}', t(kindOf(type).pluralLabel))
    : t('No matches for “{query}”')

  return (
    <EmptyState
      compact
      testid="empty-search"
      mark={<SearchGlyph size={16} />}
      title={title.replace('{query}', query)}
      primary={{ label: t('Clear search'), onClick: () => setFilterQuery(''), testid: 'empty-search-clear' }}
      // Widening the search is only an option when a kind is narrowing it.
      secondary={
        type
          ? {
              label: t('Search all items'),
              onClick: () => setFilterType(null),
              testid: 'empty-search-widen'
            }
          : undefined
      }
    />
  )
}
