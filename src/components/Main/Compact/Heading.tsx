import { APP_NAME } from '@/lib/app'
import { MONO_LABEL } from '@/components/elements/tokens'

/**
 * A tab root's large title: a mono eyebrow saying whose vault this is, and the
 * root's own name at 32px under it. It replaces the 20px column title the wide
 * shell keeps, and is the same block on every root — the list, the generator
 * and settings — so the three cannot drift apart.
 *
 * `testid` is the handle the *list* root is addressed by (`list-title`); the
 * other roots have nothing that needs finding.
 */
export default function Heading({ title, testid }: { title: string; testid?: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className={MONO_LABEL}>{APP_NAME}</div>
      <div
        data-testid={testid}
        className="mt-1 truncate text-title font-semibold tracking-display text-text"
      >
        {title}
      </div>
    </div>
  )
}
