import type { CSSProperties, ReactNode } from 'react'
import { cx } from '@/utils/cx'
import type { Palette } from './palette'

interface Props {
  palette: Palette
  /** The document's proportions: ID-1 for a card, ID-3 for a passport page. */
  aspect: string
  /** Which document this is, for the e2e suite and for anyone styling one. */
  docType: string
  /** Layout of the printed area: a card stacks, a passport is spine + page. */
  className?: string
  children: ReactNode
}

// The paper every face is printed on. The palette goes down as CSS variables,
// so the cells and the header band colour themselves without being told; the
// guilloche is a fan of hairline rings from one corner, faded out before it
// reaches the text — security paper, not wallpaper. Sized like the credit card
// (460 wide, shrinking with the pane) and cast in its shadow, so the two read
// as objects from one wallet.
//
// The proportions are a floor, not a cage. The rings layer is the one that
// carries the aspect ratio, and it shares its grid cell with the printed area,
// so the face is as tall as the real document — or as tall as its rows need
// when a phone-narrow pane folds them, rather than clipping its footer.
export default function Frame({ palette, aspect, docType, className, children }: Props) {
  const rings = `repeating-radial-gradient(circle at 92% 6%, ${palette.guilloche} 0 1px, transparent 1px 11px)`
  const fade = 'radial-gradient(circle at 92% 6%, black 0, transparent 64%)'

  return (
    <div
      data-testid="identity-face"
      data-doc-type={docType}
      style={
        {
          background: palette.paper,
          '--face-ink': palette.ink,
          '--face-ink2': palette.ink2,
          '--face-band': palette.band,
          '--face-band-ink': palette.bandInk,
          '--face-hover': 'rgba(0, 0, 0, 0.06)'
        } as CSSProperties
      }
      className="grid w-[460px] max-w-full overflow-hidden rounded-[16px] border border-black/10 text-(--face-ink) tabular-nums shadow-[0_12px_28px_rgba(0,0,0,0.22)]"
    >
      <div
        aria-hidden
        className={cx('pointer-events-none col-start-1 row-start-1 w-full self-start', aspect)}
        style={{ backgroundImage: rings, maskImage: fade, WebkitMaskImage: fade }}
      />
      <div className={cx('col-start-1 row-start-1 flex min-w-0', className)}>{children}</div>
    </div>
  )
}
