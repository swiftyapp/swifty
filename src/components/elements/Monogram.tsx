import { cx } from '@/utils/cx'

interface Props {
  /** What the tile stands for; the first letter is what it shows. */
  name: string
  /** What the hue is derived from — an id, so a rename keeps the colour. */
  seed: string
  size?: number
  className?: string
}

// A stable hue for a string: the same seed always lands on the same colour,
// and neighbouring ids spread across the wheel rather than clustering.
const hueOf = (seed: string): number => {
  let hash = 5381
  for (let i = 0; i < seed.length; i++) hash = (hash * 33) ^ seed.charCodeAt(i)
  return Math.abs(hash) % 360
}

// An identity tile: the first letter of a name on a soft wash in a hue that is
// the thing's own, so a vault is told apart at a glance before it is read. The
// lightness and chroma are theme tokens (see --monogram-* in theme.css); only
// the hue is per instance, so the tiles re-theme with everything else.
export default function Monogram({ name, seed, size = 24, className }: Props) {
  const hue = hueOf(seed)
  return (
    <span
      aria-hidden
      className={cx(
        'grid flex-none place-items-center rounded-[30%] font-semibold uppercase leading-none',
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.5),
        background: `oklch(var(--monogram-l) var(--monogram-c) ${hue})`,
        color: `oklch(var(--monogram-ink-l) var(--monogram-ink-c) ${hue})`
      }}
    >
      {name.trim().charAt(0)}
    </span>
  )
}
