// Card network marks, drawn inline so they scale crisply from list tiles to
// the card art. Circle pairs are the real geometry; wordmark networks are set
// as bold type in the network's ink (white in `light` tone for dark surfaces).
// Networks without a distinctive mark here return null — callers fall back to
// the generic card glyph.

interface Props {
  brand?: string | null
  // Height in px; width follows the 3:2 mark box.
  size?: number
  // 'light' renders wordmarks in white for dark grounds (the card art).
  tone?: 'color' | 'light'
}

const TEXT_FONT = 'ui-sans-serif, system-ui, sans-serif'

export default function CardBrandMark({ brand, size = 16, tone = 'color' }: Props) {
  const shared = {
    width: (size * 3) / 2,
    height: size,
    viewBox: '0 0 24 16',
    // Never overflow a tight tile — scale down, keeping the aspect ratio.
    style: { maxWidth: '100%', height: 'auto' },
    'aria-label': brand ?? undefined
  }

  switch (brand) {
    case 'mastercard':
      return (
        <svg {...shared}>
          <circle cx="9" cy="8" r="5.4" fill="#EB001B" />
          <circle cx="15" cy="8" r="5.4" fill="#F79E1B" />
          <path d="M12 3.7 A5.4 5.4 0 0 0 12 12.3 A5.4 5.4 0 0 0 12 3.7 Z" fill="#FF5F00" />
        </svg>
      )
    case 'maestro':
      return (
        <svg {...shared}>
          <circle cx="9" cy="8" r="5.4" fill="#ED0006" />
          <circle cx="15" cy="8" r="5.4" fill="#0099DF" />
          <path d="M12 3.7 A5.4 5.4 0 0 0 12 12.3 A5.4 5.4 0 0 0 12 3.7 Z" fill="#6C6BBD" />
        </svg>
      )
    case 'visa':
      return (
        <svg {...shared}>
          <text
            x="12"
            y="12.2"
            textAnchor="middle"
            fontFamily={TEXT_FONT}
            fontSize="10.5"
            fontWeight="800"
            fontStyle="italic"
            fill={tone === 'light' ? '#fff' : '#1A1F71'}
          >
            VISA
          </text>
        </svg>
      )
    case 'amex':
      return (
        <svg {...shared}>
          <rect width="24" height="16" rx="2.5" fill="#016FD0" />
          <text
            x="12"
            y="10.6"
            textAnchor="middle"
            fontFamily={TEXT_FONT}
            fontSize="6.4"
            fontWeight="800"
            fill="#fff"
          >
            AMEX
          </text>
        </svg>
      )
    case 'discover':
      // The wordmark is wide; it gets its own 5:2 box so it never clips.
      return (
        <svg {...shared} width={(size * 5) / 2} viewBox="0 0 40 16">
          <text
            x="20"
            y="10.6"
            textAnchor="middle"
            fontFamily={TEXT_FONT}
            fontSize="7"
            fontWeight="800"
            fill={tone === 'light' ? '#fff' : '#231F20'}
          >
            DISC
            <tspan fill="#F27712">O</tspan>
            VER
          </text>
        </svg>
      )
    default:
      return null
  }
}
