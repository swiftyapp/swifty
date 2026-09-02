// Bakes the rail mark into src/assets/images/logo.svg as a plain vector path:
// real geometry that any tool can open, edit and scale, with no SVG filter to
// rasterize or drop. The rail renders this same file (Brand.tsx), and it is
// the mark to use in READMEs, stores and decks. Run with `bun run logo`.
//
// The mascot's body is primitive shapes softened live by a blur + alpha
// threshold filter (see AsteriskBody). Here that filter is reproduced
// numerically from the same geometry: rasterize the union, blur it with the
// same sigma, and trace where coverage crosses the same threshold. The traced
// outline is then fitted with cubic Béziers. Output is 96×96 (the lock-screen
// mascot's size) in the light-theme brand ink.
//
// Flags: `--freed=dot|head` overrides the mark's freed-spike shape and
// `--out=<path>` the destination, for exporting a variant to compare.
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import fitCurve from 'fit-curve'
import {
  CENTER,
  DOT_DISTANCE,
  DOT_RADIUS,
  HEAD,
  MARK,
  SOFTEN,
  SPIKE,
  SPIKE_ANGLES,
  dotCenter,
  type Freed
} from '@/components/elements/asteriskGeometry'

const flag = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]

const SIZE = 96
const INK = '#34373e' // --c-brand, light theme
const FREED = (flag('freed') as Freed | undefined) ?? MARK.freed
const OUT = resolve(
  flag('out') ?? resolve(import.meta.dir, '../src/assets/images/logo.svg')
)

// Raster resolution, pixels per geometry unit. 16 puts the boundary error
// well under a hundredth of a unit after interpolation.
const PX = 16
const N = 64 * PX

type Point = [number, number]

/* ------------------------------------------------------------------------ */
/* Inside tests for the primitives, in geometry units.                       */

// Half-width of the upright spike at height y, or -1 outside its y-range.
function spikeHalfWidth(y: number): number {
  const { base, shoulder, tip } = SPIKE
  if (y > base.y || y < tip.y) return -1
  if (y >= shoulder.y) {
    const t = (y - base.y) / (shoulder.y - base.y)
    return base.half + (shoulder.half - base.half) * t
  }
  // Rounded corner: quadratic from (shoulder.half, shoulder.y) via
  // (tip.control, tip.y) to (tip.half, tip.y). Its y(t) = tip.y + (shoulder.y
  // - tip.y)(1-t)², so invert for t, then evaluate x(t).
  const s = Math.sqrt((y - tip.y) / (shoulder.y - tip.y))
  const t = 1 - s
  return s * s * shoulder.half + 2 * s * t * tip.control + t * t * tip.half
}

// Undo a spike's placement: rotate back, then unscale about its axis. Returns
// the point in the upright spike frame as (offset from axis, y).
function toSpikeFrame(x: number, y: number, angle: number, width: number) {
  const rad = (-angle * Math.PI) / 180
  const dx = x - CENTER
  const dy = y - CENTER
  return {
    ux: (dx * Math.cos(rad) - dy * Math.sin(rad)) / width,
    uy: CENTER + dx * Math.sin(rad) + dy * Math.cos(rad)
  }
}

function insideSpike(x: number, y: number, angle: number, width: number) {
  const { ux, uy } = toSpikeFrame(x, y, angle, width)
  return Math.abs(ux) <= spikeHalfWidth(uy)
}

// The rounded spike-head slab, upright at DOT_DISTANCE in the spike frame.
function insideHead(x: number, y: number, angle: number, width: number) {
  const { ux, uy } = toSpikeFrame(x, y, angle, width)
  const hx = Math.abs(ux) - (HEAD.width / 2 - HEAD.radius)
  const hy = Math.abs(uy - (CENTER - DOT_DISTANCE)) - (HEAD.height / 2 - HEAD.radius)
  const qx = Math.max(hx, 0)
  const qy = Math.max(hy, 0)
  return Math.hypot(qx, qy) <= HEAD.radius
}

const insideCircle = (x: number, y: number, cx: number, cy: number, r: number) =>
  (x - cx) ** 2 + (y - cy) ** 2 <= r * r

/* ------------------------------------------------------------------------ */
/* The filter, numerically.                                                  */

function coverage(): Float32Array {
  const spikes = SPIKE_ANGLES.filter(a => a !== MARK.dot)
  const dot = dotCenter(MARK.dot)
  const grid = new Float32Array(N * N)
  for (let j = 0; j < N; j++) {
    const y = (j + 0.5) / PX
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) / PX
      const inside =
        insideCircle(x, y, CENTER, CENTER, MARK.hub) ||
        (FREED === 'dot'
          ? insideCircle(x, y, dot.x, dot.y, DOT_RADIUS)
          : insideHead(x, y, MARK.dot, MARK.spike)) ||
        spikes.some(a => insideSpike(x, y, a, MARK.spike))
      if (inside) grid[j * N + i] = 1
    }
  }
  return grid
}

function gaussianBlur(src: Float32Array, sigmaUnits: number): Float32Array {
  const sigma = sigmaUnits * PX
  const radius = Math.ceil(sigma * 3)
  const kernel = new Float32Array(radius * 2 + 1)
  let sum = 0
  for (let k = -radius; k <= radius; k++) {
    kernel[k + radius] = Math.exp(-(k * k) / (2 * sigma * sigma))
    sum += kernel[k + radius]
  }
  for (let k = 0; k < kernel.length; k++) kernel[k] /= sum

  const tmp = new Float32Array(N * N)
  const out = new Float32Array(N * N)
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      let acc = 0
      for (let k = -radius; k <= radius; k++) {
        const ii = i + k
        if (ii >= 0 && ii < N) acc += src[j * N + ii] * kernel[k + radius]
      }
      tmp[j * N + i] = acc
    }
  }
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      let acc = 0
      for (let k = -radius; k <= radius; k++) {
        const jj = j + k
        if (jj >= 0 && jj < N) acc += tmp[jj * N + i] * kernel[k + radius]
      }
      out[j * N + i] = acc
    }
  }
  return out
}

// Bilinear sample of the blurred coverage at a point in geometry units.
function sample(field: Float32Array, x: number, y: number): number {
  const fx = Math.min(Math.max(x * PX - 0.5, 0), N - 1.001)
  const fy = Math.min(Math.max(y * PX - 0.5, 0), N - 1.001)
  const i = Math.floor(fx)
  const j = Math.floor(fy)
  const u = fx - i
  const v = fy - j
  const at = (a: number, b: number) => field[b * N + a]
  return (
    at(i, j) * (1 - u) * (1 - v) +
    at(i + 1, j) * u * (1 - v) +
    at(i, j + 1) * (1 - u) * v +
    at(i + 1, j + 1) * u * v
  )
}

/* ------------------------------------------------------------------------ */
/* Tracing and fitting.                                                      */

// Both the body and the dot are star-shaped about their own centers (every
// ray from the center leaves the shape exactly once), so the outline is the
// first threshold crossing along each ray. Returns points in angular order.
function traceLoop(
  field: Float32Array,
  threshold: number,
  cx: number,
  cy: number,
  samples: number
): Point[] {
  const points: Point[] = []
  for (let s = 0; s < samples; s++) {
    const a = (s / samples) * 2 * Math.PI
    const dx = Math.sin(a)
    const dy = -Math.cos(a)
    const inside = (r: number) => sample(field, cx + dx * r, cy + dy * r) >= threshold
    let lo = 0
    let hi = 0.25
    while (inside(hi)) {
      lo = hi
      hi += 0.25
    }
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2
      if (inside(mid)) lo = mid
      else hi = mid
    }
    const r = (lo + hi) / 2
    points.push([cx + dx * r, cy + dy * r])
  }
  return points
}

const fmt = (n: number) => {
  const s = n.toFixed(2)
  return s.replace(/\.?0+$/, '') || '0'
}

// Fit a closed loop with cubic Béziers. The loop is rotated to start at
// `startAt` (a fraction of the way round) so the seam falls on a straight
// stretch, where a tiny tangent mismatch between the last and first curve is
// invisible.
function loopToPath(points: Point[], startAt: number, maxError: number) {
  const k = Math.round(points.length * startAt)
  const rotated = [...points.slice(k), ...points.slice(0, k), points[k]]
  const curves = fitCurve(rotated, maxError) as Point[][]
  let d = `M${fmt(curves[0][0][0])} ${fmt(curves[0][0][1])}`
  for (const [, c1, c2, p] of curves) {
    d += ` C${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(p[0])} ${fmt(p[1])}`
  }
  return { d: d + ' Z', segments: curves.length }
}

/* ------------------------------------------------------------------------ */

const threshold = -SOFTEN.offset / SOFTEN.slope
const field = gaussianBlur(coverage(), SOFTEN.blur)

// Start the body seam ~20° past the top spike's axis: on its straight edge.
const body = loopToPath(
  traceLoop(field, threshold, CENTER, CENTER, 1440),
  20 / 360,
  0.005
)

// The freed piece is traced about its own center. A dot comes out a
// near-perfect circle, grown by the filter, so it stays a circle at its
// measured radius; the head slab is fitted like the body, seam on a long side.
const dot = dotCenter(MARK.dot)
const freedLoop = traceLoop(field, threshold, dot.x, dot.y, 360)
let freedSvg: string
let freedNote: string
if (FREED === 'dot') {
  const r =
    freedLoop.reduce((acc, [x, y]) => acc + Math.hypot(x - dot.x, y - dot.y), 0) /
    freedLoop.length
  freedSvg = `<circle cx="${fmt(dot.x)}" cy="${fmt(dot.y)}" r="${fmt(r)}"/>`
  freedNote = `dot r=${fmt(r)}`
} else {
  const head = loopToPath(freedLoop, (MARK.dot + 90) / 360, 0.005)
  freedSvg = `<path d="${head.d}"/>`
  freedNote = `head ${head.segments} curves`
}

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 64 64" fill="${INK}" aria-label="Swifty">\n` +
  `  <path d="${body.d}"/>\n` +
  `  ${freedSvg}\n` +
  `</svg>\n`

writeFileSync(OUT, svg)
console.log(
  `wrote ${OUT} (body ${body.segments} curves, ${freedNote}, ${svg.length} bytes)`
)
