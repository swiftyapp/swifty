import { useCallback, useEffect, useState } from 'react'
import {
  defaultSettings,
  entropy,
  generate,
  persistDefaults,
  type GeneratorSettings
} from '@/services/generator'

// Holds the dialog's settings and the value they produced. Every settings
// change — and every press of the regenerate button — draws a fresh secret.
export function useGenerator() {
  const [settings, setSettings] = useState<GeneratorSettings>(defaultSettings)
  const [value, setValue] = useState('')
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let current = true
    generate(settings)
      .then(next => {
        if (current) setValue(next)
      })
      .catch(() => {})
    return () => {
      current = false
    }
  }, [settings, nonce])

  // Whatever the dialog is set to becomes the default for next time. Idempotent,
  // so the initial pass (which read those very values) is a no-op write.
  useEffect(() => persistDefaults(settings), [settings])

  const update = useCallback(
    (patch: Partial<GeneratorSettings>) =>
      setSettings(previous => ({ ...previous, ...patch })),
    []
  )

  const regenerate = useCallback(() => setNonce(previous => previous + 1), [])

  return { settings, value, update, regenerate, ...entropy(settings) }
}
