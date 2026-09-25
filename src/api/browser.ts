import { call } from './client'

/**
 * The browser extension host (desktop only): Rowel speaks the KeePassXC-Browser
 * protocol, so the stock extension fills logins from the vault. Every command
 * that changes something answers with the whole status as it now stands, so
 * Settings redraws from what Rust says rather than from a guess.
 */
export interface BrowserStatus {
  enabled: boolean
  /**
   * Every browser Rust knows how to register with. `detected` is its profile
   * directory being there; `installed` is the manifest it finds Rowel by, which
   * is written on enabling and only for a detected browser; `conflict` is that
   * place already held by KeePassXC itself, which Rowel leaves alone.
   */
  browsers: {
    id: string
    label: string
    detected: boolean
    installed: boolean
    conflict: boolean
  }[]
  /**
   * The extensions let into the open vault: the name they were given, and
   * their public key. Each vault keeps its own list.
   */
  clients: { name: string; key: string }[]
}

export type BrowserClient = BrowserStatus['clients'][number]

export const browserStatus = (): Promise<BrowserStatus> => call('browser_status')

export const browserSetEnabled = (enabled: boolean): Promise<BrowserStatus> =>
  call('browser_set_enabled', { enabled })

/** Answer the `browser:associate` ask: the name to remember it by, or null to refuse. */
export const browserRespond = (name: string | null): Promise<void> =>
  call('browser_respond', { name })

export const browserForgetClient = (key: string): Promise<BrowserStatus> =>
  call('browser_forget_client', { key })
