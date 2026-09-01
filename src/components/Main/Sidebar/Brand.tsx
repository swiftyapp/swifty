// Single-vault app: the rail top is just a brand mark (no vault switcher).
//
// The mark is "Reveal": a masked-password asterisk with one arm detached as a
// dot — the one secret in your hand. The asterisk is the native symbol of a
// secrets app (it's what a masked password looks like), and the dot seeds the
// lock-screen mascot's eye. Five stadium arms at 60° plus the dot where the
// sixth would be; arms overlap the center so the union fills solid.
const ARM_ANGLES = [0, 60, 180, 240, 300]

export default function Brand() {
  return (
    <div
      className="grid h-10 w-10 flex-none place-items-center rounded-lg"
      style={{
        background:
          'linear-gradient(150deg, var(--c-accent), var(--c-accent-deep))',
        boxShadow: '0 1px 0 rgba(255,255,255,.18) inset'
      }}
      title="Swifty"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-label="Swifty">
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
