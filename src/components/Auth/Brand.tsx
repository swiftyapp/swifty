import Mascot, { type MascotState } from '@/components/elements/Mascot'
import Wordmark from '@/components/elements/Wordmark'

interface Props {
  state: MascotState
  gaze: number
}

// The lock screen's masthead: the mascot with the wordmark tucked under it.
// The wordmark sits close enough to read as the mascot's nameplate, and the
// mascot's cheer and shake happen above it — the name never moves.
export default function Brand({ state, gaze }: Props) {
  return (
    <div className="mb-9 flex flex-col items-center">
      <Mascot state={state} gaze={gaze} />
      <Wordmark className="mt-1" />
    </div>
  )
}
