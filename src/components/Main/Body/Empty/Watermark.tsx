import Logo from '@/assets/images/logo.svg?react'

// The brand asterisk as the ground of an empty pane: oversized, tilted, run off
// the lower-right corner and faded toward the content, so the pane reads as a
// designed surface rather than a blank one and the mark in the middle has
// something of its own to stand on. Ink-tinted at a few percent, so it
// re-themes with the brand ink (graphite on light, chalk on dark) and never
// competes with what sits over it.
//
// Wide shell only: on the phone the empty state sits inside the list's own
// scroller, where a bleed off the corner has no corner to bleed off.
export default function Watermark() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-[220px] -right-[180px] select-none text-brand opacity-[0.08] [mask-image:linear-gradient(135deg,transparent_10%,#000_60%)] max-md:hidden"
    >
      <Logo width={680} height={680} className="-rotate-[14deg] fill-current" />
    </div>
  )
}
