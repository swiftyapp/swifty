import Search from './Search'
import Tags from './Tags'
import SyncIndicator from './SyncIndicator'
import Controls from '@/components/elements/Controls'

export default function Header() {
  return (
    <div className="header">
      <Search />
      <Tags />
      <SyncIndicator />
      <Controls />
    </div>
  )
}
