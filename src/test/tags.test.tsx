import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import Tags from '@/components/Main/Header/Tags'
import { makeStore, setFilterType } from '@/store'
import { renderWithStore, withEntries, loginMeta } from './utils'

describe('Tags filter', () => {
  // Regression: the selector used to build a fresh [tag, count][] inside the
  // store selector, so useSyncExternalStore's snapshot was never referentially
  // stable and React looped ("Maximum update depth exceeded"), blanking the app.
  // A render that loops throws here; reaching the assertions proves it's stable.
  it('renders a chip per tag in view without an infinite render loop', () => {
    const store = makeStore()
    withEntries(store, [
      loginMeta({ id: 'a', tags: ['work', 'email'] }),
      loginMeta({ id: 'b', tags: ['work'] })
    ])

    renderWithStore(<Tags />, { store })

    expect(screen.getByText('work')).toBeInTheDocument()
    expect(screen.getByText('email')).toBeInTheDocument()
  })

  it('counts tags across every kind while the list is unfiltered', () => {
    const store = makeStore()
    withEntries(store, [
      loginMeta({ id: 'a', tags: ['shared'] }),
      loginMeta({ id: 'c', type: 'card', tags: ['shared', 'money'], urlHost: '' })
    ])

    renderWithStore(<Tags />, { store })

    // "shared" is used by a login and a card; under All Items both count.
    expect(screen.getByText('shared').nextElementSibling).toHaveTextContent('2')
    expect(screen.getByText('money')).toBeInTheDocument()
  })

  it('recounts against the filtered kind only', () => {
    const store = makeStore()
    withEntries(store, [
      loginMeta({ id: 'a', tags: ['shared'] }),
      loginMeta({ id: 'c', type: 'card', tags: ['shared', 'money'], urlHost: '' })
    ])
    setFilterType('login')

    renderWithStore(<Tags />, { store })

    expect(screen.getByText('shared').nextElementSibling).toHaveTextContent('1')
    // A card-only tag is not on offer while the list shows logins.
    expect(screen.queryByText('money')).not.toBeInTheDocument()
    setFilterType(null)
  })
})
