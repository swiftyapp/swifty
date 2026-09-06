import { useDialogFocus } from '@/hooks/useDialogFocus'
import { useForwardedRef } from '@/hooks/useForwardedRef'
import { useVisualViewport, viewportStyle } from '@/hooks/useVisualViewport'
import type { FrameProps } from './Frame'

/**
 * The compact frame for a dialog that is only as tall as what it says.
 *
 * A picker with six tiles in it has no business taking a whole screen: it
 * arrives from the bottom edge instead, over a scrim that dismisses it, with a
 * grabber saying which way it goes. It is as modal as the page sheet — focus
 * starts inside, Tab stays inside, Escape closes — and it is sized from the
 * visual viewport for the same reason `Sheet` is: if a field in it ever takes
 * focus, the keyboard must not land on top of it.
 */
export default function BottomSheet({ onClose, labelledBy, testid, ref, children }: FrameProps) {
  const view = useVisualViewport()
  const [frame, setFrame] = useForwardedRef<HTMLDivElement>(ref)
  useDialogFocus(frame, onClose)

  return (
    <div
      ref={setFrame}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-labelledby={labelledBy}
      data-testid={testid}
      // Which frame won, for anything asking (tests, styling hooks) without
      // having to read class names off the element.
      data-frame="bottom-sheet"
      style={viewportStyle(view)}
      className="animate-fade fixed inset-0 z-50 flex flex-col justify-end"
    >
      {/* The scrim is its own layer rather than the frame's background: the card
          sits on top of it, so a tap that lands on one is never both. */}
      <div className="absolute inset-0 bg-scrim" onClick={onClose} />
      <div className="animate-rise relative flex max-h-full flex-col rounded-t-2xl border-t border-line2 bg-detail text-text shadow-float">
        <div className="flex flex-none justify-center pt-2.5 pb-1">
          <span className="h-1 w-9 rounded-full bg-line2" />
        </div>
        {/* The home indicator lives under the card's last row; 24px keeps the
            content off it. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+24px)]">
          {children}
        </div>
      </div>
    </div>
  )
}
