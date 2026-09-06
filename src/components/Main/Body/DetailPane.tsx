import { cx } from '@/utils/cx'
import Aside from './Aside'

// The right pane: hosts the existing Aside (Show / Form / Audit / Empty).
// Deep detail styling is PR 5 — this provides the scroll surface + padding so
// the current content stays functional and readable in both themes.
// The gutters are the caller's: 34px a side is a sixth of a phone.
export default function DetailPane({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        'flex min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-detail text-text',
        className ?? 'pt-[26px] px-[34px] pb-[60px]'
      )}
    >
      <Aside />
    </div>
  )
}
