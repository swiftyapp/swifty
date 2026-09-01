import Aside from './Aside'

// The right pane: hosts the existing Aside (Show / Form / Audit / Empty).
// Deep detail styling is PR 5 — this provides the scroll surface + padding so
// the current content stays functional and readable in both themes.
export default function DetailPane() {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-detail pt-[26px] px-[34px] pb-[60px] text-text">
      <Aside />
    </div>
  )
}
