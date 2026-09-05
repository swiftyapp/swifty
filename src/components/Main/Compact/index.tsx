import { useStore } from '@/store'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import ListColumn from '../Body/ListColumn'
import DetailPane from '../Body/DetailPane'
import SettingsOverlay from '../Sidebar/Settings/Overlay'
import Tags from '../Sidebar/Tags'
import Add from '../Sidebar/Add'
import TopBar from './TopBar'
import TabBar from './TabBar'

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
  const height = useVisualViewport()

  return (
    <div
      data-testid="compact-shell"
      style={{ height: height ?? undefined }}
      className="flex h-full min-h-0 flex-col"
    >
      <TopBar detail={detail} />
      {detail ? (
        <DetailPane />
      ) : (
        <ListColumn
          actions={
            <>
              <Tags compact />
              <Add compact />
            </>
          }
        />
      )}
      {!detail && <TabBar />}
      <SettingsOverlay />
    </div>
  )
}
