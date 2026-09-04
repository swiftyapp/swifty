import { describe, it, expect, beforeEach } from 'vitest'
import { makeStore, useStore, setEntries, setCurrentEntry, setFilterTag, editEntry } from './index'
import { filterEntries } from '@/services/entries'
import type { EntryMeta } from '@/lib/commands'

const meta = (id: string, tags: string[] = []): EntryMeta =>
  ({ id, type: 'login', title: id, tags, urlHost: '', favorite: false })

const items = [meta('work', ['work']), meta('home', ['home']), meta('both', ['work', 'home'])]

const visible = () => {
  const { filters, entries } = useStore.getState()
  return filterEntries(entries.items, filters).map(e => e.id)
}

beforeEach(() => {
  makeStore()
  setEntries(items)
})

describe('setFilterTag', () => {
  it('starts unset, so every row is in scope', () => {
    expect(useStore.getState().filters.tag).toBeNull()
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

    expect(useStore.getState().entries.current?.id).toBe('both')
  })

  it('drops a selection the new tag would hide, along with the open editor', () => {
    setCurrentEntry('home')
    editEntry()
    setFilterTag('work')

    const { current, edit } = useStore.getState().entries
    expect(current).toBeNull()
    expect(edit).toBe(false)
  })

  it('keeps the selection when the filter is cleared', () => {
    setCurrentEntry('home')
    setFilterTag(null)

    expect(useStore.getState().entries.current?.id).toBe('home')
  })

  it('is independent of the kind filter — both narrow the same list', () => {
    setFilterTag('work')
    useStore.getState().setFilterType('login')

    expect(useStore.getState().filters).toMatchObject({ type: 'login', tag: 'work' })
    expect(visible()).toEqual(['work', 'both'])
  })
})
