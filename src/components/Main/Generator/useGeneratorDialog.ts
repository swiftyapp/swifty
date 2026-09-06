import { useCallback, useState } from 'react'
import { copy } from '@/services/copy'
import { startEntry } from '@/store'
import type { TKey } from '@/i18n'
import type { GeneratorApply, SshApply } from '@/store/generatorSlice'
import { useGenerator } from './useGenerator'
import { useSshKey } from './Ssh/useSshKey'
import type { DialogMode } from './Tabs'

/**
 * Everything the generator *is*, with no opinion about where it is drawn: the
 * mode it is showing, the value or keypair that mode produced, and the one
 * action that ends it.
 *
 * Both shells take this hook — the wide card (`Dialog`) and the phone's tab
 * root (`Compact/Generator`) — so a change to what "generate" means lands in
 * both at once. What differs between them is only the frame around `Panel` and
 * where the confirm button sits.
 *
 * `onClose` is what confirming leads to: dismissing the dialog on the desktop,
 * nothing at all on a tab root, which is left through the tab bar.
 */
export function useGeneratorDialog(
  apply: GeneratorApply | null,
  ssh: SshApply | null,
  onClose: () => void
) {
  const { settings, value, update, regenerate, bits, level } = useGenerator()
  // Opened off the ssh private-key row, the generator is that one job —
  // otherwise it starts on whatever password mode the settings remember.
  const [mode, setMode] = useState<DialogMode>(ssh ? 'ssh' : settings.mode)
  const key = useSshKey(mode === 'ssh')
  const keys = mode === 'ssh'

  // `ssh` is a face of the generator rather than a fourth password shape, so
  // switching to it must not write itself into the persisted defaults.
  const changeMode = useCallback(
    (next: DialogMode) => {
      setMode(next)
      if (next !== 'ssh') update({ mode: next })
    },
    [update]
  )

  // A keypair fills a whole draft, so standalone it opens a new entry rather
  // than landing on the clipboard the way a password does. While a draw is in
  // flight (or has failed) confirming does nothing: the pair on screen is the
  // one the user asked to replace, not the one they'd be saving.
  const confirm = useCallback(() => {
    if (keys) {
      if (!key.ready || !key.pair) return
      if (ssh) ssh(key.pair)
      else startEntry('ssh', key.pair)
      onClose()
      return
    }
    if (!value) return
    apply?.(value)
    copy(value)
    onClose()
  }, [keys, key.ready, key.pair, ssh, apply, value, onClose])

  const confirmLabel: TKey = keys ? (ssh ? 'Use' : 'Save as SSH key') : 'Use & copy'

  return {
    mode,
    setMode: changeMode,
    keys,
    key,
    // Whether confirming can do anything: a password is always there, a keypair
    // only once the draw has landed. Both shells disable their confirm on it,
    // rather than each re-deriving what "not ready" means.
    ready: !keys || key.ready,
    settings,
    value,
    bits,
    level,
    update,
    // One control, whichever mode is showing: the thing on screen, again.
    regenerate: keys ? key.regenerate : regenerate,
    confirm,
    confirmLabel
  }
}

export type GeneratorDialog = ReturnType<typeof useGeneratorDialog>
