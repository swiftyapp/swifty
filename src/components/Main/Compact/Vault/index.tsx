import ListColumn from '../../Body/ListColumn'
import { useListTitle } from '../../Body/ListColumn/useListTitle'
import SortMenu from '../../Body/List/SortMenu'
import { DetailEmpty } from '../../Body/Empty'
import { useVariant, isWholeView } from '../../Body/Empty/variant'
import Tags from '../../Sidebar/Tags'
import Add from '../../Sidebar/Add'
import { TAB_BAR_CLEARANCE } from '../chrome'
import Heading from '../Heading'

// iOS's minimum touch target, for the controls the rail draws at 36px.
const TOUCH = 'h-11 w-11'

// The 44px search field. Passed as classes rather than asked for by a flag:
// the box is the same field, dressed for a finger.
const SEARCH =
  'mt-4 flex h-11 items-center gap-2.5 rounded-lg border border-line bg-field pl-3.5 pr-2.5 text-text3 transition-colors focus-within:border-accent-line [&_input]:text-md'

/**
 * The list root — the screen the tab bar comes home to.
 *
 * The shared list column, with the phone's chrome around it: a large title
 * where the desktop has a 20px one, the rail's add and tag tiles in the title
 * row (there is no rail), and room at the bottom of the scroller for the
 * floating bar the rows slide under.
 */
export default function Vault() {
  // The list is the only pane here, so it also carries the hero the wide shell
  // shows in its detail pane — otherwise an empty vault is a blank screen.
  const variant = useVariant()
  const title = useListTitle()

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-list pt-[env(safe-area-inset-top)]">
      <ListColumn
        heading={<Heading title={title} testid="list-title" />}
        actions={
          <>
            <SortMenu className={TOUCH} />
            {/* The tag tile hangs off the list header rather than a rail, so
                its menu drops below the trigger instead of out to a side. */}
            <Tags className={TOUCH} menu="right-0 top-full mt-2" />
            <Add className={TOUCH} />
          </>
        }
        search={SEARCH}
        scroller={TAB_BAR_CLEARANCE}
        footer={variant && isWholeView(variant) ? <DetailEmpty variant={variant} /> : null}
      />
    </div>
  )
}
