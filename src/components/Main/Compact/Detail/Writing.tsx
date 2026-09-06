import DetailPane from '../../Body/DetailPane'

/**
 * Interim: the wide shell's editor in the phone's gutters, which keeps every
 * kind writable until slice 4 gives writing a form screen of its own.
 *
 * The nav row is an empty 56px on purpose. A draft leaves through the editor's
 * own Cancel, which guards unsaved changes; a second way out up here would be
 * an unguarded one.
 */
export default function Writing() {
  return (
    <div className="flex min-h-0 flex-1 flex-col animate-sheet bg-detail">
      <header className="h-14 flex-none pt-[env(safe-area-inset-top)]" />
      {/* 16px of gutter a side, and room under the content for a thumb. */}
      <DetailPane className="px-4 pt-4 pb-10" />
    </div>
  )
}
