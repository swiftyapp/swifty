// Kappa: the Bézier handle length that draws a quarter ellipse.
const K = 0.5523

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const lerp = (from: number, to: number, t: number) => from + (to - from) * t
const px = (n: number) => Math.round(n * 100) / 100

/**
 * The mascot's open eye, from a round eye to a smiling one: the same outline
 * emoji use (😊), at any point in between.
 *
 * The eye is one closed path in two halves. The upper edge is always the top
 * half of the ellipse — the eye keeps its brow line. The lower edge is what
 * smiles: at `joy` 0 it is the ellipse's bottom half; as `joy` rises its
 * middle bows up past the centre line until the eye is an arch with a concave
 * underside, the way cheeks push a smiling eye up from below. The ends stay
 * put on the eye's equator with vertical tangents on both edges, so they are
 * rounded feet at every step, never points.
 */
export function smileEye(cx: number, cy: number, rx: number, ry: number, joy: number): string {
  const j = clamp01(joy)
  // Where the underside's middle sits: the ellipse's bottom, rising to a
  // notch inside the arch that leaves it about half the eye's height thick.
  const yBottom = lerp(cy + ry, cy - ry * 0.3, j)
  // The underside's handles at the ends point down at every step (that is
  // what keeps the feet round), and stay long enough once it is an arch that
  // the feet keep some flesh on them.
  const footDrop = lerp(K * ry, ry * 0.6, j)
  // The underside's handles at the middle draw in a little as it becomes a
  // notch, so the notch is a curve and not a crease.
  const notchReach = lerp(K * rx, rx * 0.66, j)

  const left = cx - rx
  const right = cx + rx
  const top = cy - ry

  return [
    `M${px(left)} ${px(cy)}`,
    // Upper edge, over the top.
    `C${px(left)} ${px(cy - K * ry)} ${px(cx - K * rx)} ${px(top)} ${px(cx)} ${px(top)}`,
    `C${px(cx + K * rx)} ${px(top)} ${px(right)} ${px(cy - K * ry)} ${px(right)} ${px(cy)}`,
    // Lower edge, back under.
    `C${px(right)} ${px(cy + footDrop)} ${px(cx + notchReach)} ${px(yBottom)} ${px(cx)} ${px(yBottom)}`,
    `C${px(cx - notchReach)} ${px(yBottom)} ${px(left)} ${px(cy + footDrop)} ${px(left)} ${px(cy)}`,
    'Z'
  ].join(' ')
}
