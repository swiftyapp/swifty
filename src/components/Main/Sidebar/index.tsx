import Add from './Add'
import Switcher from './Switcher'
import Settings from './Settings'

export default function Sidebar() {
  return (
    <div className="sidebar">
      <Add />
      <Switcher />
      <Settings />
    </div>
  )
}
