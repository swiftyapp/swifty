import { APP_NAME } from '@/lib/app'
import { MONO_LABEL } from '@/components/elements/tokens'

// The tab root's large title: a mono eyebrow saying whose vault this is, and
// the view's own name at 32px under it. It replaces the 20px column title the
// wide shell keeps, and carries the same `list-title` handle.
export default function Heading({ title }: { title: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className={MONO_LABEL}>{APP_NAME}</div>
      <div
        data-testid="list-title"
        className="mt-1 truncate text-title font-semibold tracking-display text-text"
      >
        {title}
      </div>
    </div>
  )
}
