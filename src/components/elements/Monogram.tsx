import type { CSSProperties } from 'react'
import { cx } from '@/utils/cx'

interface Props {
  /** What the tile stands for; the first letter is what it shows. */
  name: string
  /** What the hue is derived from — an id, so a rename keeps the colour. */
  seed: string
  size?: number
  // The letter's size; half the tile's unless a larger tile wants it lighter.
  fontSize?: number
  className?: string
}

// A stable hue for a string: the same seed always lands on the same colour,
// and neighbouring ids spread across the wheel rather than clustering.
const hueOf = (seed: string): number => {
  let hash = 5381
  for (let i = 0; i < seed.length; i++) hash = (hash * 33) ^ seed.charCodeAt(i)
  return Math.abs(hash) % 360
}

// An identity chip: the first letter of a name on a flat tint in a hue that is
// the thing's own, so a vault is told apart at a glance before it is read. The
// tint, ink and hairline edge are the `monogram` utility in theme.css, themed
// there; only the hue is per instance, handed down as `--hue`.
export default function Monogram({
  name,
  seed,
  size = 24,
  fontSize = Math.round(size * 0.5),
  className
}: Props) {
  return (
    <span
      aria-hidden
      className={cx(
        'monogram grid flex-none place-items-center rounded-[30%] font-semibold uppercase leading-none',
        className
      )}
      style={{ width: size, height: size, fontSize, '--hue': hueOf(seed) } as CSSProperties}
    >
      {name.trim().charAt(0)}
    </span>
  )
}
