import { useStore } from '@/store'
import { useVisualViewport, viewportStyle } from '@/hooks/useVisualViewport'
import ListColumn from '../Body/ListColumn'
import DetailPane from '../Body/DetailPane'
import SortMenu from '../Body/List/SortMenu'
import { DetailEmpty } from '../Body/Empty'
import { useVariant, isWholeView } from '../Body/Empty/variant'
import SettingsSheet from '../Sidebar/Settings/SettingsSheet'
import Tags from '../Sidebar/Tags'
import Add from '../Sidebar/Add'
import TopBar from './TopBar'
import TabBar from './TabBar'

// iOS's minimum touch target, for the controls the rail draws at 36px.
const TOUCH = 'h-11 w-11'

/**
 * The phone shell: one screen at a time between a slim top bar and the tab bar.
 *
 * The list is the root screen; picking an entry — or starting a new one, or
 * editing — pushes the detail screen over it full width, and the top bar grows
 * a back control. The tab bar is the list screen's alone: switching view from
 * inside a detail would drop the selection (and any draft) out from under it.
 */
export default function Compact() {
  const detail = useStore(state => state.entries.current !== null || state.entries.new !== null)
  const settings = useStore(state => state.ui.settings)
  // The list is the only pane here, so it also carries the hero the wide shell
  // shows in its detail pane — otherwise an empty vault is a blank screen.
  const variant = useVariant()
  const view = useVisualViewport()

  return (
    <>
      <div
        data-testid="compact-shell"
        style={viewportStyle(view)}
        className="flex h-full min-h-0 flex-col"
      >
        <TopBar detail={detail} />
        {detail ? (
          // 34px of gutter a side is a sixth of a phone.
          <DetailPane className="px-4 pt-4 pb-10" />
        ) : (
          <ListColumn
            actions={
              <>
                <SortMenu className={TOUCH} />
                {/* The tag tile hangs off the list header rather than a rail, so
                    its menu drops below the trigger instead of out to a side. */}
                <Tags className={TOUCH} menu="right-0 top-full mt-2" />
                <Add className={TOUCH} />
              </>
            }
            footer={variant && isWholeView(variant) ? <DetailEmpty variant={variant} /> : null}
          />
        )}
        {!detail && <TabBar />}
      </div>
      {/* A sibling, not a child: the shell's translate would make it the
          containing block for the sheet's `fixed`, and the sheet already
          applies the same offset itself — inside, it would move twice. */}
      {settings && <SettingsSheet />}
    </>
  )
}
