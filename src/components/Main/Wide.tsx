import Sidebar from './Sidebar'
import Header from './Header'
import Body from './Body'
import Generator from './Generator'

// The desktop and iPad shell, unchanged: top chrome over the icon rail, the
// list column and the detail pane, all on screen at once.
//
// Every way of opening the generator here is a dialog over that — there is
// nowhere else for it to go — so this shell mounts the store-driven one. The
// phone splits it in two (see `Compact`).
export default function Wide() {
  return (
    <>
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <Body />
      </div>
      <Generator />
    </>
  )
}
