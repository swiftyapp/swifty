import { cx } from '@/utils/cx'
import { PANE_PAD } from '@/components/elements/tokens'
import Aside from './Aside'

export default function DetailPane({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        'flex min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-detail text-text',
        className ?? PANE_PAD
      )}
    >
      <Aside />
    </div>
  )
}
