import { describe, it, expect } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EVENTS } from '@/api/events'
import type { PasskeyAsk } from '@/api/browser'
import BrowserPasskey from '@/components/Main/BrowserPasskey'
import { useUi } from '@/store'
import { clearSession } from '@/store/app'
import { subscribeToEvents } from '@/store/events'
import { calls } from './ipc'
import { emitEvent } from './events'

const REGISTER: PasskeyAsk = {
  kind: 'register',
  rpId: 'example.com',
  origin: 'https://login.example.com',
  userName: 'alice',
  userDisplayName: 'Alice Example'
}

const GET: PasskeyAsk = { kind: 'get', rpId: 'github.com', origin: 'https://github.com' }

describe('the passkey consent dialog', () => {
  const ask = async (payload: PasskeyAsk = REGISTER) => {
    subscribeToEvents()
    render(<BrowserPasskey />)
    act(() => emitEvent(EVENTS.browserPasskey, payload))
    return screen.findByTestId('browser-passkey-modal')
  }

  it('names the site, the account and the page, and sends a yes on Allow', async () => {
    const modal = await ask()
    expect(screen.getByTestId('browser-passkey-title')).toHaveTextContent(
      'example.com wants to create a passkey for alice'
    )
    expect(modal).toHaveTextContent('https://login.example.com')

    await userEvent.click(screen.getByTestId('browser-passkey-allow'))

    expect(calls('browser_passkey_respond')).toEqual([{ allow: true }])
    expect(screen.queryByTestId('browser-passkey-modal')).not.toBeInTheDocument()
    expect(useUi.getState().passkeyAsk).toBeNull()
  })

  it('asks to sign in, and sends a no on Deny', async () => {
    await ask(GET)
    expect(screen.getByTestId('browser-passkey-title')).toHaveTextContent(
      'github.com wants to sign in with your passkey'
    )

    await userEvent.click(screen.getByTestId('browser-passkey-deny'))

    expect(calls('browser_passkey_respond')).toEqual([{ allow: false }])
    expect(screen.queryByTestId('browser-passkey-modal')).not.toBeInTheDocument()
  })

  it('falls back to the display name, then to no account at all', async () => {
    await ask({ ...REGISTER, userName: '' })
    expect(screen.getByTestId('browser-passkey-title')).toHaveTextContent(
      'example.com wants to create a passkey for Alice Example'
    )
    act(() =>
      emitEvent(EVENTS.browserPasskey, { ...REGISTER, userName: undefined, userDisplayName: '' })
    )
    expect(screen.getByTestId('browser-passkey-title')).toHaveTextContent(
      /^example\.com wants to create a passkey$/
    )
  })

  it('replaces an ask still on screen with a newer one', async () => {
    await ask()
    act(() => emitEvent(EVENTS.browserPasskey, GET))

    expect(screen.getByTestId('browser-passkey-title')).toHaveTextContent(
      'github.com wants to sign in with your passkey'
    )
  })

  it('is gone once the vault locks', async () => {
    await ask()
    act(() => clearSession())

    expect(screen.queryByTestId('browser-passkey-modal')).not.toBeInTheDocument()
    expect(calls('browser_passkey_respond')).toEqual([])
  })
})
