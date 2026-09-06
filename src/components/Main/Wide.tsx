import Sidebar from './Sidebar'
import Header from './Header'
import Body from './Body'

// The desktop and iPad shell, unchanged: top chrome over the icon rail, the
// list column and the detail pane, all on screen at once.
export default function Wide() {
  return (
    <>
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <Body />
      </div>
    </>
  )
}
