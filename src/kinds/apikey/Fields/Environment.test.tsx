import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FieldsProvider } from '@/components/elements/fields'
import type { EntryDraft } from '@/defaults/entries'
import Environment from './Environment'

const edit = (environment: string, set = vi.fn()) => {
  const entry: EntryDraft = { type: 'apikey', title: 'Coupler.io', environment }
  render(
    <FieldsProvider value={{ entry, set, attempted: false }}>
      <Environment />
    </FieldsProvider>
  )
  return set
}

describe('the environment switch, editing', () => {
  it('lights the stored environment and switches on click', async () => {
    const set = edit('test')
    expect(screen.getByTestId('apikey-environment-test')).toBeChecked()

    await userEvent.click(screen.getByTestId('apikey-environment-production'))
    expect(set).toHaveBeenCalledWith('environment', 'production')
  })

  // Optional means it can be taken back: a set environment offers a clear, an
  // unset one lights no segment and has nothing to clear.
  it('clears a set environment back to none', async () => {
    const set = edit('production')
    await userEvent.click(screen.getByTestId('clear-environment'))
    expect(set).toHaveBeenCalledWith('environment', '')
  })

  it('offers no clear while nothing is set', () => {
    edit('')
    expect(screen.getByTestId('apikey-environment-test')).not.toBeChecked()
    expect(screen.getByTestId('apikey-environment-production')).not.toBeChecked()
    expect(screen.queryByTestId('clear-environment')).toBeNull()
  })

  it('renders nothing when reading', () => {
    const entry: EntryDraft = { type: 'apikey', title: 'Coupler.io', environment: 'production' }
    render(
      <FieldsProvider value={{ entry, set: null, attempted: false }}>
        <Environment />
      </FieldsProvider>
    )
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })
})
