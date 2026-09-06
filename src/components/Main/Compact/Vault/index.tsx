import ListColumn from '../../Body/ListColumn'
import { useListTitle } from '../../Body/ListColumn/useListTitle'
import SortMenu from '../../Body/List/SortMenu'
import Audit from '../../Body/Aside/Audit'
import { DetailEmpty } from '../../Body/Empty'
import { useVariant, isWholeView } from '../../Body/Empty/variant'
import Tags from '../../Sidebar/Tags'
import Add from '../../Sidebar/Add'
import { TAB_BAR_CLEARANCE, TOUCH } from '../chrome'
import Heading from '../Heading'

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
  // The list is the only pane here, so it also carries whatever the wide shell
  // puts in its detail pane — otherwise an empty vault is a blank screen, and
  // the audit view is its groups with no score.
  const variant = useVariant()
  const title = useListTitle()

  // The same call `Body/Aside` makes for the wide detail pane: no variant means
  // the audit has a score to show, and the audit is the only view that can be
  // scored. A filter-shaped empty (`kind`, `search`, `select`) belongs to the
  // list column, which draws it among the rows itself.
  const footer = variant ? (
    isWholeView(variant) && <DetailEmpty variant={variant} />
  ) : (
    // The rows run edge to edge; the score panel wants the screen's gutters.
    <div className="px-4">
      <Audit />
    </div>
  )

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
        footer={footer}
      />
    </div>
  )
}
