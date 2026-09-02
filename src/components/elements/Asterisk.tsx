import { useId, type CSSProperties } from 'react'
import {
  CENTER,
  HUB_RADIUS,
  SPIKE_ANGLES,
  SPIKE_PATH,
  SOFTEN,
  spikeTransform
} from './asteriskGeometry'

interface Props {
  style?: CSSProperties
}

// The brand asterisk's body as the lock-screen mascot wears it (all six
// spikes, full hub), to be rendered inside an `<svg viewBox="0 0 64 64">`.
// Drawn from primitives and softened live by the blur + threshold filter, so
// the mascot can recolor it per state. The rail mark is the same geometry in
// its own variant, baked to a plain path by `bun run logo`; see
// asteriskGeometry.ts. Fill comes from `style` or the surrounding svg's `fill`.
export default function AsteriskBody({ style }: Props) {
  const filterId = `asterisk-soften-${useId().replace(/\W/g, '')}`

  return (
    <>
      <defs>
        <filter id={filterId} x="-15%" y="-15%" width="130%" height="130%">
          <feGaussianBlur
            in="SourceGraphic"
            stdDeviation={SOFTEN.blur}
            result="b"
          />
          <feColorMatrix
            in="b"
            type="matrix"
            values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${SOFTEN.slope} ${SOFTEN.offset}`}
          />
        </filter>
      </defs>
      <g filter={`url(#${filterId})`} style={style}>
        {SPIKE_ANGLES.map(angle => (
          <path
            key={angle}
            d={SPIKE_PATH}
            transform={spikeTransform(angle, 1)}
          />
        ))}
        <circle cx={CENTER} cy={CENTER} r={HUB_RADIUS} />
      </g>
    </>
  )
}
