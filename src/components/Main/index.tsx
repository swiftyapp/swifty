import Sidebar from './Sidebar'
import Header from './Header'
import Body from './Body'
import Palette from './Palette'
import Generator from './Generator'
import { useShortcuts } from './useShortcuts'

// Three-pane shell: a full-width top chrome bar over a row of
// rail (68px) · list column (348px) · detail pane (flex).
export function Main() {
  useShortcuts()

  return (
    <div
      data-testid="main-view"
      className="flex h-full flex-col overflow-hidden bg-app font-sans text-text select-none"
    >
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <Body />
      </div>
      <Palette />
      <Generator />
    </div>
  )
}

export default Main
