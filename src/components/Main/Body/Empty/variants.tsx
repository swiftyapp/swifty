import type { EntryType } from '@/lib/commands'
import { syncImport } from '@/lib/commands'
import {
  useStore,
  openAddPicker,
  openSettings,
  startEntry,
  setFilterQuery,
  setFilterType,
  syncPending,
  syncFailed
} from '@/store'
import { kindOf } from '@/kinds'
import { useTranslation } from 'react-i18next'
import Logo from '@/assets/images/logo.svg?react'
import EmptyState from '@/components/elements/EmptyState'
import { ActivityGlyph, ArchiveGlyph, SearchGlyph, StarGlyph } from '../../icons'

// The brand mark at whatever size the surface asks for — the same baked logo
// the rail shows, so the empty vault and the open one read as one character.
// `fill-current` overrides the file's baked ink so the mark takes the text
// colour of whatever tile it sits in.
const Mark = ({ size }: { size: number }) => (
  <Logo width={size} height={size} className="fill-current" aria-hidden="true" />
)

// First run — the one hero in the app. Nothing exists yet, so this is the only
// thing on screen worth looking at and it gets the full treatment.
export function VaultEmpty() {
  const { t } = useTranslation()
  const sync = useStore(state => state.sync)

  // The spinner runs off the store, not off the promise: on mobile `sync_import`
  // resolves the moment the consent page is on screen, and what ends the wait is
  // `sync:connected`/`sync:error` and then the pull's own events. On success the
  // restored entries replace this screen; on failure the button has to come back
  // rather than spin forever.
  const restore = () => {
    syncPending()
    syncImport().catch(error => syncFailed(String(error)))
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
        sync.enabled
          ? {
              label: t('Restore from Google Drive'),
              onClick: restore,
              loading: sync.pending || sync.inProgress
            }
          : { label: t('Import from another app'), onClick: openSettings }
      }
      hints={[
        { keys: '⌘N', label: t('add') },
        { keys: '⌘K', label: t('commands') }
      ]}
    />
  )
}

// The vault has entries and none is open. Deliberately quiet — no tile, no
// body, no buttons: the hero treatment belongs to the empty vault alone, and
// this state is one arrow key away from real content.
export function SelectEmpty() {
  const { t } = useTranslation()
  return (
    <EmptyState
      testid="empty-select"
      mark={<Mark size={28} />}
      markClassName="bg-transparent text-text3"
      titleClassName="text-text2"
      title={t('Select an item')}
      hints={[
        { keys: '↑↓', label: t('browse') },
        { keys: '⏎', label: t('copy') },
        { keys: '⌘F', label: t('search') },
        { keys: '⌘N', label: t('add') },
        { keys: '⌘K', label: t('commands') }
      ]}
    />
  )
}

// Vault Health with no password to score yet.
export function HealthEmpty() {
  const { t } = useTranslation()
  return (
    <EmptyState
      testid="empty-health"
      mark={<ActivityGlyph size={28} />}
      title={t('Nothing to audit yet')}
      body={t('Your score appears once a login with a password is saved.')}
      primary={{ label: t(kindOf('login').addLabel), onClick: () => startEntry('login') }}
    />
  )
}

// The Favorites view with nothing starred yet — a whole-view state, so it gets
// the pane's full hero and says how to fill itself.
export function FavoritesEmpty() {
  const { t } = useTranslation()
  return (
    <EmptyState
      testid="empty-favorites"
      mark={<StarGlyph size={28} />}
      title={t('No favorites yet')}
      body={t('Star an entry to keep it here.')}
    />
  )
}

export function ArchiveEmpty() {
  const { t } = useTranslation()
  return (
    <EmptyState
      testid="empty-archive"
      mark={<ArchiveGlyph size={28} />}
      title={t('Nothing archived yet')}
      body={t('Archived entries wait here until you restore them or delete them for good.')}
    />
  )
}

export function KindEmpty({ type }: { type: EntryType }) {
  const { t } = useTranslation()
  const { Glyph, emptyLabel, addLabel } = kindOf(type)

  return (
    <EmptyState
      compact
      testid="empty-kind"
      mark={<Glyph />}
      title={t(emptyLabel)}
      primary={{ label: t(addLabel), onClick: () => startEntry(type), testid: 'empty-kind-add' }}
    />
  )
}

// A query that matched nothing, naming the query back so it's obvious why the
// list is blank. The kind filter, when one is on, is the other half of the why.
export function SearchEmpty({ query, type }: { query: string; type: EntryType | null }) {
  const { t } = useTranslation()
  const title = type
    ? t(kindOf(type).noMatchesLabel, { query })
    : t('No matches for “{{query}}”', { query })

  return (
    <EmptyState
      compact
      testid="empty-search"
      mark={<SearchGlyph size={16} />}
      title={title}
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
