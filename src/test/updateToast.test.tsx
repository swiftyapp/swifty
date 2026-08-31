import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UpdateToast from '@/components/elements/UpdateToast'
import { makeStore } from '@/store'
import { restartForUpdate } from '@/services/autoUpdate'

vi.mock('@/services/autoUpdate', () => ({ restartForUpdate: vi.fn().mockResolvedValue(undefined) }))

beforeEach(() => {
  vi.clearAllMocks()
  makeStore()
})

describe('UpdateToast', () => {
  it('renders nothing when no update is staged and no check is running', () => {
    const { container } = render(<UpdateToast />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the staged version + notes and restarts on "Restart Now"', async () => {
    const store = makeStore()
    store.getState().setUpdateReady('1.2.0', 'Fixes a crash')
    render(<UpdateToast />)

    expect(screen.getByText('Update Ready')).toBeInTheDocument()
    expect(screen.getByText('Version 1.2.0 has been downloaded.')).toBeInTheDocument()
    expect(screen.getByText('Fixes a crash')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Restart Now'))
    expect(restartForUpdate).toHaveBeenCalledOnce()
  })

  it('dismisses the toast on "Later" without restarting', async () => {
    const store = makeStore()
    store.getState().setUpdateReady('1.2.0', null)
    render(<UpdateToast />)

    await userEvent.click(screen.getByText('Later'))
    expect(restartForUpdate).not.toHaveBeenCalled()
    expect(store.getState().update.readyVersion).toBeNull()
  })
})
