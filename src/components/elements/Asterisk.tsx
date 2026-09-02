import { useId, type CSSProperties } from 'react'

// The brand asterisk: a masked character, the secret you can't read. One
// silhouette shared by the lock-screen mascot (which puts a face on it) and
// the rail mark (which sets one spike free as a dot), so the two always agree
// on shape. Drawn in a 64-unit box centered at 32: a round hub and six flared
// spikes at 60° whose tips reach 29 from center. Spike bases (corners 10 from
// center) are buried under the hub so the union fills solid.
const CENTER = 32
// The mascot's hub is full enough to carry a face. Faceless uses can go
// smaller to open up the notches; below ~10.5 the spike bases start to show.
const HUB_RADIUS = 14
const SPIKE_ANGLES = [0, 60, 120, 180, 240, 300]

// One flared spike, pointing up: narrow at the base, wide at the tip, soft
// outer corners. Rotated around the hub for the other five.
const SPIKE = 'M26 24 L24 7 Q23.5 3 27.5 3 L36.5 3 Q40.5 3 40 7 L38 24 Z'

// The freed spike's dot: as wide as a spike head, floated a little past the
// spike-tip circle (tips reach 29; the dot's outer edge reaches 31) so it
// reads as clearly let go of the body. Set against an 11 hub that leaves a
// 6-unit gap; the soften filter needs at least 4 or it bridges them.
const DOT_RADIUS = 7
const DOT_DISTANCE = 24

interface Props {
  // Angle (one of the six spike angles) to draw as a detached dot instead of
  // a spike. The mascot draws all six; the rail mark frees the lower-right one.
  dot?: number
  // Hub radius; defaults to the mascot's.
  hub?: number
  style?: CSSProperties
}

// The body, to be rendered inside an `<svg viewBox="0 0 64 64">`. Fill comes
// from `style` or the surrounding svg's `fill`. The blur + alpha threshold
// rounds every corner of the combined silhouette, including the concave notch
// bottoms, which per-shape stroke joins cannot fillet.
export default function AsteriskBody({
  dot,
  hub = HUB_RADIUS,
  style
}: Props) {
  const filterId = `asterisk-soften-${useId().replace(/\W/g, '')}`
  const rad = ((dot ?? 0) * Math.PI) / 180
  const dotX = CENTER + Math.sin(rad) * DOT_DISTANCE
  const dotY = CENTER - Math.cos(rad) * DOT_DISTANCE

  return (
    <>
      <defs>
        <filter id={filterId} x="-15%" y="-15%" width="130%" height="130%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="b" />
          <feColorMatrix
            in="b"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -13"
          />
        </filter>
      </defs>
      <g filter={`url(#${filterId})`} style={style}>
        {SPIKE_ANGLES.filter(angle => angle !== dot).map(angle => (
          <path
            key={angle}
            d={SPIKE}
            transform={angle ? `rotate(${angle} ${CENTER} ${CENTER})` : undefined}
          />
        ))}
        <circle cx={CENTER} cy={CENTER} r={hub} />
        {dot !== undefined && <circle cx={dotX} cy={dotY} r={DOT_RADIUS} />}
      </g>
    </>
  )
}
