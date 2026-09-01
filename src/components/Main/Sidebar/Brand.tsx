// Single-vault app: the rail top is just a brand mark (no vault switcher).
//
// The mark is "Reveal": a masked-password asterisk with one arm detached as a
// dot — the one secret in your hand. Five stadium arms at 60° plus the dot
// where the sixth would be; arms overlap the center so the union fills solid.
// Drawn plain in the accent ink, no tile behind it — the mark is the brand.
const ARM_ANGLES = [0, 60, 180, 240, 300]

export default function Brand() {
  return (
    <div className="grid h-10 w-10 flex-none place-items-center text-accent" title="Swifty">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-label="Swifty">
        {ARM_ANGLES.map(angle => (
          <rect
            key={angle}
            x="10.4"
            y="3.4"
            width="3.2"
            height="9.6"
            rx="1.6"
            transform={`rotate(${angle} 12 12)`}
          />
        ))}
        <circle cx="18.06" cy="15.5" r="2.1" />
      </svg>
    </div>
  )
}
