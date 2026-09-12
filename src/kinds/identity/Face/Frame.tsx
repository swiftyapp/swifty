import type { CSSProperties, ReactNode } from 'react'
import { cx } from '@/utils/cx'

interface Props {
  /** The document's proportions: ID-3 for a passport page, ID-1 for a card. */
  aspect: string
  /** Which document this is, for the e2e suite and for anyone styling one. */
  docType: string
  children: ReactNode
}

/*
 * The paper every document face is printed on.
 *
 * One slate for all of them. A passport, a licence and an ID card were each
 * printed on their own tinted stock here once — pink, cool white, green — and
 * the colour never said anything the eyebrow was not already saying, while it
 * cost five palettes to keep in step. They are one kind of object in the vault,
 * so they are one object on the page.
 *
 * Light, where the credit card face is graphite: a card is black plastic and an
 * ID document is paper or white polycarbonate, and the two read as coming from
 * one wallet by sharing a width, a radius and a shadow rather than a colour.
 * Fixed hex for the same reason the card's are — a face stands for a physical
 * thing, so it keeps its own paper when the app goes dark.
 */
const INK = '#1B1D21'
const INK2 = '#6C6F77'
const RULE = 'rgba(20, 22, 26, 0.09)'
const TAIL = 'rgba(20, 22, 26, 0.035)'
const HOVER = 'rgba(20, 22, 26, 0.055)'

// The catch of light off the top-right corner. With the highlight along the top
// edge (the inset in the shadow below) it is what makes the slab read as a
// surface held at an angle rather than as a rectangle of colour.
const SHEEN = 'radial-gradient(120% 90% at 88% -12%, #FFFFFF 0%, rgba(255, 255, 255, 0) 62%)'

// The inks go down as CSS variables so the cells, the reveal and the
// machine-readable band colour themselves without being handed a palette.
//
// The proportions are a floor, not a cage. The sheen layer is the one that
// carries the aspect ratio, and it shares its grid cell with the printed area,
// so the face is as tall as the real document — or as tall as its rows need
// when a phone-narrow pane folds them, rather than clipping its band.
export default function Frame({ aspect, docType, children }: Props) {
  return (
    <div
      data-testid="identity-face"
      data-doc-type={docType}
      style={
        {
          '--face-ink': INK,
          '--face-ink2': INK2,
          '--face-rule': RULE,
          '--face-tail': TAIL,
          '--face-hover': HOVER
        } as CSSProperties
      }
      className="grid w-[460px] max-w-full overflow-hidden rounded-[16px] border border-[rgba(20,22,26,0.1)] bg-[linear-gradient(160deg,#FBFBFC,#ECEEF2_58%,#F4F5F8)] text-(--face-ink) tabular-nums shadow-[0_12px_28px_rgba(24,26,30,0.14),inset_0_1px_0_rgba(255,255,255,0.9)]"
    >
      <div
        aria-hidden
        className={cx('pointer-events-none col-start-1 row-start-1 w-full self-start', aspect)}
        style={{ backgroundImage: SHEEN }}
      />
      <div className="col-start-1 row-start-1 flex min-w-0 flex-col">{children}</div>
    </div>
  )
}
