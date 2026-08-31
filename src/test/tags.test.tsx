import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import Tags from '@/components/Main/Header/Tags'
import { makeStore } from '@/store'
import { renderWithStore, withEntries, loginMeta } from './utils'

describe('Tags filter', () => {
  // Regression: the selector used to build a fresh [tag, count][] inside the
  // store selector, so useSyncExternalStore's snapshot was never referentially
  // stable and React looped ("Maximum update depth exceeded"), blanking the app.
  // A render that loops throws here; reaching the assertions proves it's stable.
  it('renders a chip per in-scope tag without an infinite render loop', () => {
    const store = makeStore()
    withEntries(store, [
      loginMeta({ id: 'a', tags: ['work', 'email'] }),
      loginMeta({ id: 'b', tags: ['work'] })
    ])

    renderWithStore(<Tags />, { store })

    expect(screen.getByText('work')).toBeInTheDocument()
    expect(screen.getByText('email')).toBeInTheDocument()
  })
})
