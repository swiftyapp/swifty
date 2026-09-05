import { useRef, type ReactNode, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { useDialogFocus } from '@/hooks/useDialogFocus'
import { useVisualViewport, viewportStyle } from '@/hooks/useVisualViewport'
import { CloseGlyph } from '../Main/icons'
import IconButton from './IconButton'

interface Props {
  onClose: () => void
  /**
   * Shown in the bar beside the close control. Left out where the body already
   * carries its own heading, so the sheet does not say it twice.
   */
  title?: string
  labelledBy?: string
  testid?: string
  /** Pinned under the bar, outside the scroller (a section switcher, say). */
  toolbar?: ReactNode
  /** The frame element, for a caller that runs its own topmost-dialog check. */
  ref?: Ref<HTMLDivElement>
  children: ReactNode
}

/**
 * The compact frame for what the wide shell shows as a centered dialog.
 *
 * A phone has no room for a 470–860px card floating on a scrim, so the same
 * content takes the whole screen instead: safe-area padded, its own close
 * control in a 44px bar, and one scroller pinned to the visible viewport so a
 * focused field is not left under the keyboard. It is as modal as the card:
 * focus starts inside, Tab stays inside, and closing hands focus back.
 */
export default function Sheet({
  onClose,
  title,
  labelledBy,
  testid,
  toolbar,
  ref,
  children
}: Props) {
  const { t } = useTranslation()
  const view = useVisualViewport()
  const frame = useRef<HTMLDivElement>(null)
  useDialogFocus(frame, onClose)

  // One node, two refs: the focus trap's and whatever the caller asked for.
  const setFrame = (node: HTMLDivElement | null) => {
    frame.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }

  return (
    <div
      ref={setFrame}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label={title}
      aria-labelledby={title ? undefined : labelledBy}
      data-testid={testid}
      // Which frame won, for anything asking (tests, styling hooks) without
      // having to read class names off the element.
      data-frame="sheet"
      style={viewportStyle(view)}
      className="animate-fade fixed inset-0 z-50 flex flex-col bg-detail pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-text"
    >
      <div className="flex h-14 flex-none items-center gap-1 border-b border-line px-2">
        <IconButton
          muted
          testid="modal-close"
          label={t('Close')}
          onClick={onClose}
          className="h-11 w-11"
        >
          <CloseGlyph size={18} />
        </IconButton>
        {title && (
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-display">
            {title}
          </h1>
        )}
      </div>
      {toolbar}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  )
}
