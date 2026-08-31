import Sidebar from './Sidebar'
import Header from './Header'
import Body from './Body'

export function Main() {
  return (
    <div className="layout" data-testid="main-view">
      <Sidebar />
      <div className="mainbar">
        <Header />
        <Body />
      </div>
    </div>
  )
}

export default Main
