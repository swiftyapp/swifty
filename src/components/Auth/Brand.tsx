import Mascot, { type MascotState } from '@/components/elements/Mascot'
import Wordmark from '@/components/elements/Wordmark'

interface Props {
  state: MascotState
  gaze: number
}

// The lock screen's masthead: the mascot with the wordmark under it. The gap
// between them gives the mascot room to stand, but stays well under the gap to
// whatever follows (mb-9), so the two group as one mark rather than as a
// figure and a caption. The mascot's cheer and shake happen above the name,
// which never moves.
export default function Brand({ state, gaze }: Props) {
  return (
    <div className="mb-9 flex flex-col items-center">
      <Mascot state={state} gaze={gaze} />
      <Wordmark className="mt-2.5" />
    </div>
  )
}
