// Inline, single-colour stroke icons for the app shell (rail + top chrome).
// They paint with `currentColor` so a `text-*` token themes them in both light
// and dark — unlike the legacy filled SVG assets, which hard-code black.

interface IconProps {
  size?: number
  className?: string
}

const stroke = (size: number, className: string | undefined, children: React.ReactNode) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
)

export const SearchGlyph = ({ size = 14, className }: IconProps) =>
  stroke(size, className, (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5 21 21" />
    </>
  ))

export const PlusGlyph = ({ size = 16, className }: IconProps) =>
  stroke(size, className, <path d="M12 5v14M5 12h14" />)

export const LockGlyph = ({ size = 15, className }: IconProps) =>
  stroke(size, className, (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ))

export const SunGlyph = ({ size = 15, className }: IconProps) =>
  stroke(size, className, (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ))

export const MoonGlyph = ({ size = 15, className }: IconProps) =>
  stroke(size, className, <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />)

export const GearGlyph = ({ size = 17, className }: IconProps) =>
  stroke(size, className, (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v2.6M12 18.4V21M3 12h2.6M18.4 12H21M5.6 5.6l1.9 1.9M16.5 16.5l1.9 1.9M18.4 5.6l-1.9 1.9M7.5 16.5l-1.9 1.9" />
    </>
  ))

export const LoginGlyph = ({ size = 17, className }: IconProps) =>
  stroke(size, className, (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </>
  ))

export const NoteGlyph = ({ size = 17, className }: IconProps) =>
  stroke(size, className, (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ))

export const CardGlyph = ({ size = 17, className }: IconProps) =>
  stroke(size, className, (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </>
  ))
