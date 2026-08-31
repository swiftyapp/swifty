import { pct } from './useProgress'

interface Props {
  done: number
  total: number
}

// The shared progress bar shown while the backend re-encrypts entries off-thread.
export default function Progress({ done, total }: Props) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-tile">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-200"
          style={{ width: `${pct(done, total)}%` }}
        />
      </div>
      <span className="font-mono text-base text-text3">
        {done} / {total}
      </span>
    </div>
  )
}
