interface Props {
  score: number | null
  size?: number
  testid?: string
}

const RADIUS = 13
const CIRCUMFERENCE = 2 * Math.PI * RADIUS // ~82

const scoreTone = (score: number | null) =>
  score === null || score >= 70
    ? 'var(--c-good)'
    : score >= 40
      ? 'var(--c-warn)'
      : 'var(--c-bad)'

// The 0..100 vault score as a ring with the number inside. Inherits the current
// text colour so it reads correctly on both the rail and a settings card.
export default function ScoreRing({ score, size = 30, testid }: Props) {
  const dash = score === null ? 0 : (score / 100) * CIRCUMFERENCE

  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="18" r={RADIUS} stroke="var(--c-line2)" strokeWidth="2" />
      {score !== null && (
        <circle
          cx="18"
          cy="18"
          r={RADIUS}
          stroke={scoreTone(score)}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
          transform="rotate(-90 18 18)"
        />
      )}
      <text
        data-testid={testid}
        x="18"
        y="21.5"
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize="9"
        fill="currentColor"
      >
        {score === null ? '—' : score}
      </text>
    </svg>
  )
}
