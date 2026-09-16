import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'
import { isMobile } from '@/lib/platform'

// A signed update is staged (downloaded) in the background, then applied on the
// next launch. Rather than silently relaunching, we surface a toast so the user
// consents to restarting now — the staged update still applies whenever they do.

export type UpdateCheckResult =
  | { kind: 'staged'; version: string; notes: string | null }
  | { kind: 'uptodate' }
  // No check was made and none can be: this build has no updater to ask.
  | { kind: 'unsupported' }
  | { kind: 'error'; message: string }

// Checks once and, if a newer release exists, downloads + stages it. Never
// throws — offline / endpoint down / bad manifest all come back as `error`.
export const checkForUpdate = async (): Promise<UpdateCheckResult> => {
  // The App Store ships mobile updates; the updater plugin isn't even linked
  // there. Not `uptodate` — no version was queried, so claiming the app is
  // current would be a guess dressed up as an answer.
  if (isMobile) return { kind: 'unsupported' }

  try {
    const update = await check()
    if (!update) return { kind: 'uptodate' }

    await update.downloadAndInstall()
    return { kind: 'staged', version: update.version, notes: update.body?.trim() || null }
  } catch (err) {
    return { kind: 'error', message: String(err) }
  }
}

// Startup check: silent, a no-op in dev (unsigned, no endpoint), and only ever
// calls `onStaged` when an update was actually staged.
export const runStartupUpdateCheck = async (
  onStaged: (version: string, notes: string | null) => void
): Promise<void> => {
  if (import.meta.env.DEV) return

  const result = await checkForUpdate()
  if (result.kind === 'staged') onStaged(result.version, result.notes)
}

// Relaunches the app to apply a previously-staged update.
export const restartForUpdate = (): Promise<void> => relaunch()
