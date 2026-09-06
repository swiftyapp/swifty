import Output from './Output'
import Amount from './Amount'
import Toggles from './Toggles'
import Ssh from './Ssh'
import type { GeneratorDialog } from './useGeneratorDialog'

/**
 * What the generator shows: a keypair, or a secret with the two controls that
 * shape it. No frame, no title and no confirm — those belong to whoever is
 * drawing it, which is the wide card or the phone's tab root.
 */
export default function Panel({ generator }: { generator: GeneratorDialog }) {
  const { keys, key, settings, value, bits, level, update } = generator

  if (keys)
    return (
      <Ssh
        pair={key.pair}
        pending={key.pending}
        error={key.error}
        onRetry={key.regenerate}
        comment={key.comment}
        onComment={key.setComment}
      />
    )

  return (
    <>
      <Output value={value} bits={bits} level={level} />
      <Amount settings={settings} onChange={update} />
      <Toggles settings={settings} onChange={update} />
    </>
  )
}
