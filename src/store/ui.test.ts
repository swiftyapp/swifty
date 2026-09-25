import { describe, it, expect, beforeEach } from 'vitest'
import {
  useUi,
  useVault,
  selectCurrent,
  setEntries,
  setCurrentEntry,
  setFilterTag,
  setFilterType,
  editEntry,
  setView,
  showTag,
  showKind
} from './index'
import { filterEntries } from '@/services/entries'
import type { EntryMeta } from '@/api/types'

const meta = (id: string, tags: string[] = []): EntryMeta =>
  ({ id, type: 'login', title: id, tags, urlHost: '', favorite: false })

const items = [meta('work', ['work']), meta('home', ['home']), meta('both', ['work', 'home'])]

const current = () => selectCurrent(useVault.getState())

const visible = () => {
  const { filterType, filterTag, query } = useUi.getState()
  return filterEntries(useVault.getState().items, { type: filterType, tag: filterTag, query }).map(
    e => e.id
  )
}

beforeEach(() => setEntries(items))

describe('setFilterTag', () => {
  it('starts unset, so every row is in scope', () => {
    expect(useUi.getState().filterTag).toBeNull()
    expect(visible()).toHaveLength(3)
  })

  it('narrows the rows to the entries carrying the tag', () => {
    setFilterTag('work')
    expect(visible()).toEqual(['work', 'both'])
  })

  it('restores every row when cleared', () => {
    setFilterTag('work')
    setFilterTag(null)
    expect(visible()).toHaveLength(3)
  })

  it('keeps a selection the new tag still shows', () => {
    setCurrentEntry('both')
    setFilterTag('work')

    expect(current()?.id).toBe('both')
  })

  it('drops a selection the new tag would hide, along with the open editor', () => {
    setCurrentEntry('home')
    editEntry()
    setFilterTag('work')

    expect(current()).toBeNull()
    expect(useVault.getState().editing).toBe(false)
  })

  it('keeps the selection when the filter is cleared', () => {
    setCurrentEntry('home')
    setFilterTag(null)

    expect(current()?.id).toBe('home')
  })

  it('is independent of the kind filter — both narrow the same list', () => {
    setFilterTag('work')
    setFilterType('login')

    expect(useUi.getState()).toMatchObject({ filterType: 'login', filterTag: 'work' })
    expect(visible()).toEqual(['work', 'both'])
  })
})

describe('views', () => {
  it('enters the Tags view with its tag in one step', () => {
    showTag('work')
    expect(useUi.getState()).toMatchObject({ view: 'tags', filterTag: 'work' })
  })

  it('drops the tag and the selection on the way to another view', () => {
    showTag('work')
    setCurrentEntry('both')

    setView('favorites')

    expect(useUi.getState()).toMatchObject({ view: 'favorites', filterTag: null })
    expect(current()).toBeNull()
  })

  it('enters All Items narrowed to a kind from another view, leaving the tag behind', () => {
    showTag('work')
    setCurrentEntry('both')

    showKind('login')

    expect(useUi.getState()).toMatchObject({ view: 'items', filterType: 'login', filterTag: null })
    expect(current()).toBeNull()
  })

  it('keeps a selection the kind still admits when already in All Items', () => {
    setCurrentEntry('both')
    showKind('login')

    expect(useUi.getState()).toMatchObject({ view: 'items', filterType: 'login' })
    expect(current()?.id).toBe('both')
  })

  it('drops the kind on the way to another view', () => {
    showKind('login')
    setView('favorites')

    expect(useUi.getState()).toMatchObject({ view: 'favorites', filterType: null })
  })
})
