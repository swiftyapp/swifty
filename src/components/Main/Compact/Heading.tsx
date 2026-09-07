/**
 * A tab root's title: the root's own name at 24px, centred on the 56px header
 * row (`ROOT_HEADER`) with the 44px action tiles beside it. It replaces the
 * 20px column title the wide shell keeps, and is the same block on every root
 * — the list, the generator and settings — so the three cannot drift apart.
 *
 * Deliberately not the 34px large title iOS puts on a tab root: with a search
 * field and a chip row under it the screen has plenty to say already, and the
 * app's name needs no saying — the icon on the home screen did that.
 *
 * `testid` is the handle the *list* root is addressed by (`list-title`); the
 * other roots have nothing that needs finding.
 */
export default function Heading({ title, testid }: { title: string; testid?: string }) {
  return (
    <div
      data-testid={testid}
      className="min-w-0 flex-1 truncate text-2xl font-semibold tracking-display text-text"
    >
      {title}
    </div>
  )
}
