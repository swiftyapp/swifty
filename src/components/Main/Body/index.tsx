import ListColumn from './ListColumn'
import DetailPane from './DetailPane'

// The two content panes to the right of the rail: list column + detail pane.
export default function Body() {
  return (
    <>
      <ListColumn />
      <DetailPane />
    </>
  )
}
