import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Show from '@/components/Main/Body/Aside/Show'
import { revealEntry } from '@/lib/commands'
import { kindOf } from '@/kinds'
import { t } from '@/i18n'
import { renderWithStore, loginEntry, loginMeta } from './utils'

beforeEach(() => vi.clearAllMocks())

// The detail pane's chrome: what it says about the entry around the kind's own
// field set. The field set itself is covered by entry.test.tsx.
describe('Show chrome', () => {
  it('names the kind once and reduces the stamps to one footer line', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry())
    renderWithStore(<Show entry={loginMeta()} />)

    // The eyebrow above the title is the only place the kind is named; the
    // "Type" ledger cell that repeated it is gone.
    expect(screen.getAllByText(t(kindOf('login').label))).toHaveLength(1)
    expect(screen.queryByText('Type')).not.toBeInTheDocument()
    expect(screen.getByTestId('entry-stamps')).toHaveTextContent(
      /^Modified .+ · Created .+$/
    )
  })

  it('filters the list by a tag pressed in the detail pane', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ tags: ['work'] }))
    const { store } = renderWithStore(<Show entry={loginMeta({ tags: ['work'] })} />)

    await userEvent.click(await screen.findByLabelText('Filter by tag work'))
    expect(store.getState().filters.query).toBe('work')
  })
})
