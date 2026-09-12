import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { pickEnvFile } from '@/lib/commands'
import { ingestDroppedEnvFile, ingestEnvFile, type IngestedEnv } from './ingest'

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * The lifecycle shared by every interactive env-file entry point.
 *
 * Only the newest request may publish a result, completion calls the latest
 * consumer (rather than the render that began the read), and failures become
 * visible state. Unmount invalidates the request so a departed surface cannot
 * update itself later.
 */
export function useEnvIngest(onFile: (file: IngestedEnv) => void) {
  const consumer = useRef(onFile)
  const request = useRef(0)
  const [error, setError] = useState<string | null>(null)

  // Match the committed render before any in-flight read is allowed to publish.
  // (Writing a ref during render is deliberately forbidden by this repo's hook
  // lint rules; the same indirection is used by `useFileDrop`.)
  useLayoutEffect(() => {
    consumer.current = onFile
  })

  useEffect(
    () => () => {
      ++request.current
    },
    []
  )

  const run = async (load: () => Promise<IngestedEnv | null>) => {
    const mine = ++request.current
    setError(null)
    try {
      const file = await load()
      if (mine === request.current && file) consumer.current(file)
    } catch (cause) {
      if (mine === request.current) setError(messageOf(cause))
    }
  }

  const drop = (path: string) => run(() => ingestDroppedEnvFile(path))
  const pick = () =>
    run(async () => {
      const path = await pickEnvFile()
      return path ? ingestEnvFile(path) : null
    })

  return { drop, pick, error }
}
