import { pct } from './useProgress'

interface Props {
  done: number
  total: number
}

// The shared progress bar shown while the backend re-encrypts entries off-thread.
export default function Progress({ done, total }: Props) {
  return (
    <div className="import-progress">
      <div className="bar">
        <div className="fill" style={{ width: `${pct(done, total)}%` }} />
      </div>
      <span>
        {done} / {total}
      </span>
    </div>
  )
}
