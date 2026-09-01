// Single-vault app: the rail top is just a brand mark (no vault switcher).
// The mark is a monoline "S" swept from two arcs with a slight forward slant —
// same stroke language as the lucide glyphs, so it reads as part of the set.
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-label="Swifty">
        <path
          d="M15.3 8.7 A3.3 3.3 0 1 0 12 12 A3.3 3.3 0 1 1 8.7 15.3"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          transform="rotate(-10 12 12)"
        />
      </svg>
    </div>
  )
}
