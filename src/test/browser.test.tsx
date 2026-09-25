import { describe, it, expect } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EVENTS } from '@/api/events'
import type { BrowserStatus } from '@/api/browser'
import Settings from '@/components/Main/Sidebar/Settings'
import BrowserAssociate from '@/components/Main/BrowserAssociate'
import { openSettings, useUi } from '@/store'
import { subscribeToEvents } from '@/store/events'
import { calls, mockCommand } from './ipc'
import { emitEvent } from './events'

const KEY = 'AAAAbbbbCCCCddddEEEEffffGGGGhhhhIIIIjjjjKKK='

const status = (overrides: Partial<BrowserStatus> = {}): BrowserStatus => ({
  enabled: false,
  browsers: [
    { id: 'chrome', label: 'Google Chrome', detected: true, installed: false, conflict: false },
    { id: 'edge', label: 'Microsoft Edge', detected: true, installed: false, conflict: true },
    { id: 'firefox', label: 'Firefox', detected: false, installed: false, conflict: false }
  ],
  clients: [],
  ...overrides
})

const openSection = async () => {
  openSettings('browser')
  render(<Settings />)
  return screen.findByTestId('settings-browser-chrome')
}

describe('Settings › Browser extension', () => {
  it('shows what Rust reports and turns the host on', async () => {
    mockCommand('browser_status', () => status())
    mockCommand('browser_set_enabled', () =>
      status({
        enabled: true,
        browsers: [
          { id: 'chrome', label: 'Google Chrome', detected: true, installed: true, conflict: false }
        ]
      })
    )
    const chrome = await openSection()

    expect(chrome).toHaveTextContent('Detected')
    expect(screen.getByTestId('settings-browser-edge')).toHaveTextContent('Registered to KeePassXC')
    expect(screen.getByTestId('settings-browser-firefox')).toHaveTextContent('Not found')
    expect(screen.getByTestId('settings-browser-clients-empty')).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('settings-browser-toggle'))

    expect(calls('browser_set_enabled')).toEqual([{ enabled: true }])
    expect(screen.getByTestId('settings-browser-toggle')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('settings-browser-chrome')).toHaveTextContent('Ready')
  })

  it('forgets a connected extension', async () => {
    mockCommand('browser_status', () => status({ clients: [{ name: 'Work Chrome', key: KEY }] }))
    await openSection()
    const row = screen.getByTestId('settings-browser-client')
    expect(row).toHaveTextContent('Work Chrome')
    expect(row).toHaveTextContent('AAAAbbbb…KKK=')

    await userEvent.click(within(row).getByTestId('settings-browser-forget'))

    expect(calls('browser_forget_client')).toEqual([{ key: KEY }])
    expect(screen.queryByTestId('settings-browser-client')).not.toBeInTheDocument()
  })
})

describe('the browser consent dialog', () => {
  const ask = async (key = KEY) => {
    subscribeToEvents()
    render(<BrowserAssociate />)
    act(() => emitEvent(EVENTS.browserAssociate, { key }))
    return screen.findByTestId('browser-associate-modal')
  }

  it('opens on the ask and sends the name it was given', async () => {
    await ask()
    expect(screen.getByTestId('browser-associate-fingerprint')).toHaveTextContent('AAAAbbbb…KKK=')
    const name = screen.getByTestId('browser-associate-name')
    expect(name).toHaveValue('Browser')

    await userEvent.clear(name)
    await userEvent.type(name, 'Work laptop')
    await userEvent.click(screen.getByTestId('browser-associate-allow'))

    expect(calls('browser_respond')).toEqual([{ name: 'Work laptop' }])
    expect(screen.queryByTestId('browser-associate-modal')).not.toBeInTheDocument()
    expect(useUi.getState().browserAsk).toBeNull()
  })

  it('sends null on Deny', async () => {
    await ask()
    await userEvent.click(screen.getByTestId('browser-associate-deny'))

    expect(calls('browser_respond')).toEqual([{ name: null }])
    expect(screen.queryByTestId('browser-associate-modal')).not.toBeInTheDocument()
  })

  it('replaces an ask still on screen with a newer one', async () => {
    await ask()
    act(() => emitEvent(EVENTS.browserAssociate, { key: 'ZZZZyyyyXXXXwwww0000=' }))

    expect(screen.getByTestId('browser-associate-fingerprint')).toHaveTextContent('ZZZZyyyy…000=')
  })
})
