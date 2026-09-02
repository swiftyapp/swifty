// Geometry of the brand asterisk, shared by the AsteriskBody component (the
// lock-screen mascot's body, drawn live and softened by an SVG filter) and
// scripts/logo.tsx (which bakes the same softened outline, in the rail mark's
// variant, into the plain vector path at src/assets/images/logo.svg that the
// rail and everything outside the app display). Change the shape here and
// only here, then `bun run logo`.
//
// A masked character, the secret you can't read. Drawn in a 64-unit box
// centered at 32: a round hub and six flared spikes at 60° whose tips reach
// 29 from center. Spike bases (corners 10 from center) are buried under the
// hub so the union fills solid.
export const CENTER = 32

// The mascot's hub is full enough to carry a face. Faceless uses can go
// smaller to open up the notches; below ~10.5 the spike bases start to show.
export const HUB_RADIUS = 14
export const SPIKE_ANGLES = [0, 60, 120, 180, 240, 300]

// One flared spike pointing up, as half-widths about the axis x = CENTER:
// narrow at the base, wide at the shoulder, then a rounded tip whose corners
// are quadratic curves from the shoulder to the flat top.
export const SPIKE = {
  base: { y: 24, half: 6 },
  shoulder: { y: 7, half: 8 },
  tip: { y: 3, half: 4.5, control: 8.5 }
}

const { base, shoulder, tip } = SPIKE
const L = CENTER - shoulder.half
const R = CENTER + shoulder.half
export const SPIKE_PATH =
  `M${CENTER - base.half} ${base.y} L${L} ${shoulder.y} ` +
  `Q${CENTER - tip.control} ${tip.y} ${CENTER - tip.half} ${tip.y} ` +
  `L${CENTER + tip.half} ${tip.y} Q${CENTER + tip.control} ${tip.y} ${R} ${shoulder.y} ` +
  `L${CENTER + base.half} ${base.y} Z`

// Per-spike transform: rotate into place and, for slimmer variants, scale the
// width about the spike's own axis so flare, tip rounding and reach stay put.
export const spikeTransform = (angle: number, width: number) =>
  `rotate(${angle} ${CENTER} ${CENTER})` +
  (width !== 1
    ? ` translate(${CENTER} 0) scale(${width} 1) translate(${-CENTER} 0)`
    : '')

// The freed spike's dot: as wide as a spike head, floated a little past the
// spike-tip circle (tips reach 29; the dot's outer edge reaches 31) so it
// reads as clearly let go of the body. Set against an 11 hub that leaves a
// 6-unit gap; the soften filter needs at least 4 or it bridges them.
export const DOT_RADIUS = 7
export const DOT_DISTANCE = 24

// What the freed spike becomes. `dot`: a plain circle. `head`: a heavily
// rounded slab a little bigger than a spike head, so the freed piece reads as
// the tip that came off rather than a plain period. It's sized up so that,
// even this rounded (and after the soften filter rounds it further), a hint
// of straight edge survives; a 16×12 slab at radius 5 already reads as a
// circle. Drawn upright in the spike's frame at DOT_DISTANCE and placed with
// the spike transform, so it inherits the slimming and points along the freed
// spike's axis.
export type Freed = 'dot' | 'head'
export const HEAD = { width: 17, height: 13, radius: 5.5 }

export const dotCenter = (angle: number) => {
  const rad = (angle * Math.PI) / 180
  return {
    x: +(CENTER + Math.sin(rad) * DOT_DISTANCE).toFixed(2),
    y: +(CENTER - Math.cos(rad) * DOT_DISTANCE).toFixed(2)
  }
}

// The soften filter: a Gaussian blur, then alpha remapped as
// `alpha * slope + offset` and clamped, which keeps everything above
// `-offset / slope` (0.43) coverage. Rounds every corner of the combined
// silhouette, including the concave notch bottoms that per-shape stroke joins
// cannot fillet, and grows edges by about 0.3 units.
export const SOFTEN = { blur: 1.8, slope: 30, offset: -13 }

// The rail mark's variant of the body: the lower-right spike set free as a
// rounded head, and, with no face to carry, a trimmed hub and slimmer spikes
// so the notches open and it still reads as an asterisk at rail size.
export const MARK: { dot: number; hub: number; spike: number; freed: Freed } = {
  dot: 120,
  hub: 11,
  spike: 0.85,
  freed: 'head'
}
