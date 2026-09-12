import type { CSSProperties, ReactNode } from 'react'
import { cx } from '@/utils/cx'

interface Props {
  /**
   * The document's real proportions, as `width / height` in millimetres — the
   * shape of the thing in your hand, and the one fixed dimension of a face.
   */
  ratio: string
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
 * ID document is paper or white polycarbonate. Fixed hex for the same reason the
 * card's are — a face stands for a physical thing, so it keeps its own paper
 * when the app goes dark.
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

/**
 * The ratio sizes the face, so a document is the shape it really is: a passport
 * page is squarer than a licence because a passport page *is* squarer, and
 * neither is whatever height its contents happened to add up to. A ratio rather
 * than a fixed height, so it is the same object at any pane width.
 *
 * It is carried by a spacer sharing one grid cell with the printing, rather than
 * by `aspect-ratio` on the face itself, and the difference is the whole safety
 * of this. A ratio on the face fixes its height outright, and `overflow-hidden`
 * then swallows anything that does not fit — on a phone-narrow pane the foot of
 * the document went under the rounded corner. (`min-height: auto` does not save
 * it: that only resolves to the content size for a flex or grid *item*, and a
 * face is neither everywhere it is used. Nor does `min-height: fit-content`.)
 * One grid cell holding both takes the taller of the two, which is exactly the
 * rule wanted: the ratio decides the height while the printing fits, and the
 * printing decides it when it does not. In a password manager a value you cannot
 * see is worse than a document half a centimetre too tall — and the layout's job
 * is to keep that the rare case rather than to rely on it.
 */
export default function Frame({ ratio, docType, children }: Props) {
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
      className={cx(
        'relative grid w-[460px] max-w-full overflow-hidden rounded-[16px]',
        'border border-[rgba(20,22,26,0.1)] bg-[linear-gradient(160deg,#FBFBFC,#ECEEF2_58%,#F4F5F8)]',
        'text-(--face-ink) tabular-nums',
        'shadow-[0_12px_28px_rgba(24,26,30,0.14),inset_0_1px_0_rgba(255,255,255,0.9)]'
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{ backgroundImage: SHEEN }}
      />
      <div
        aria-hidden
        className="col-start-1 row-start-1 w-full self-start"
        style={{ aspectRatio: ratio }}
      />
      <div className="col-start-1 row-start-1 flex min-w-0 flex-col">{children}</div>
    </div>
  )
}
