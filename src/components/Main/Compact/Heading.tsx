/**
 * A tab root's title: the root's own name at 24px, centred on the 56px header
 * row (`ROOT_HEADER`) with the 44px action tiles beside it. It replaces the
 * 20px column title the wide shell keeps, and is the same block on the
 * generator and settings roots; the list root draws the column's own `Title`
 * at this size instead, since in All Items that title is also the scope menu.
 *
 * Deliberately not the 34px large title iOS puts on a tab root: with a search
 * field under it the screen has plenty to say already, and the app's name
 * needs no saying — the icon on the home screen did that.
 */
export default function Heading({ title }: { title: string }) {
  return (
    <div className="min-w-0 flex-1 truncate text-2xl font-semibold tracking-display text-text">
      {title}
    </div>
  )
}
