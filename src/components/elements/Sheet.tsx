import { useEffect, type ReactNode, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { useVisualViewport } from '@/hooks/useVisualViewport'
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
  ref?: Ref<HTMLDivElement>
  children: ReactNode
}

/**
 * The compact frame for what the wide shell shows as a centered dialog.
 *
 * A phone has no room for a 470–860px card floating on a scrim, so the same
 * content takes the whole screen instead: safe-area padded, its own close
 * control in a 44px bar, and one scroller sized to the visible viewport so a
 * focused field is not left under the keyboard.
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
  const height = useVisualViewport()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      aria-labelledby={title ? undefined : labelledBy}
      data-testid={testid}
      style={{ height: height ?? undefined }}
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
