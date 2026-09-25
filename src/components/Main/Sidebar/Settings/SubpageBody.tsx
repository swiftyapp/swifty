import type { ComponentType } from 'react'
import { SUBPAGES, type Subpage } from './subpages'

// The sub-page counterpart of `Section`: one lookup both shells render through.
// The union's `Body` props cannot be narrowed through an index, so the lookup
// is widened once here rather than cast in each shell.
export default function SubpageBody({ subpage }: { subpage: Subpage }) {
  const Body = SUBPAGES[subpage.key].Body as ComponentType<{ subpage: Subpage }>
  return <Body subpage={subpage} />
}
