import type { ReactNode } from 'react'
import Face from '@/components/elements/Face'

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

/**
 * The paper every document face is printed on — the vault's shared `Face`
 * surface, so a passport, a licence and an SSH key's fingerprint plate are one
 * kind of object on the page. A passport, a licence and an ID card were each
 * printed on their own tinted stock here once, and the colour never said
 * anything the eyebrow was not already saying.
 *
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
    <Face data-testid="identity-face" data-doc-type={docType} className="grid w-[460px] max-w-full">
      <div
        aria-hidden
        className="col-start-1 row-start-1 w-full self-start"
        style={{ aspectRatio: ratio }}
      />
      <div className="col-start-1 row-start-1 flex min-w-0 flex-col">{children}</div>
    </Face>
  )
}
