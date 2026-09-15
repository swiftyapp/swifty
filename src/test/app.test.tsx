import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import App from '@/App'
import { useApp } from '@/store'
import { appStatusDefault, calls, mockCommand } from './ipc'
import { seedApp } from './utils'

// How the shell decides where to open: off the boot probe's answer, already in
// the store — or, when that never came, off one more probe of its own.
describe('App', () => {
  it('opens on the lock screen when the probe says there is a vault', () => {
    seedApp({ initialized: true })
    render(<App />)
    expect(useApp.getState().flow).toBe('auth')
    expect(calls('app_status')).toEqual([])
  })

  it('opens on setup when the probe says there is nothing on disk', () => {
    seedApp({ initialized: false })
    render(<App />)
    expect(useApp.getState().flow).toBe('setup')
  })

  it('asks again when the boot probe never answered, so a pristine install still reaches setup', async () => {
    useApp.setState({ status: null })
    mockCommand('app_status', () => ({ ...appStatusDefault(), initialized: false }))
    render(<App />)

    await waitFor(() => expect(useApp.getState().flow).toBe('setup'))
    expect(useApp.getState().status?.initialized).toBe(false)
  })

  it('stays on the lock screen when the probe keeps failing', async () => {
    useApp.setState({ status: null })
    mockCommand('app_status', () => Promise.reject({ kind: 'other', message: 'no backend' }))
    render(<App />)

    await waitFor(() => expect(calls('app_status')).toHaveLength(1))
    expect(useApp.getState().flow).toBe('auth')
    expect(useApp.getState().status).toBeNull()
  })
})
