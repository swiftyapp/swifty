import { invoke } from '@tauri-apps/api/core'
import { isBackendError, type BackendError } from './errors'

/**
 * The single seam between the webview and Rust. Every wrapper in `@/api` goes
 * through here, and every rejection leaves as a `BackendError` — a broken IPC
 * or a thrown JS error included — so no caller has to guess what it caught.
 */
export const call = <T>(command: string, args?: Record<string, unknown>): Promise<T> =>
  invoke<T>(command, args).catch((error: unknown) => {
    const normalized: BackendError = isBackendError(error)
      ? error
      : { kind: 'other', message: String(error) }
    throw normalized
  })
