import { CARD } from '@/components/elements/tokens'

interface Props {
  /** What is being waited on, in the user's terms. */
  caption: string
  testid?: string
}

// The wait, given a shape: consent is out with the browser and there is nothing
// to do here but say what happens when it comes back. The ring is the one
// `Button` spins while loading, at the card tier.
export default function SpinnerCard({ caption, testid }: Props) {
  return (
    <div
      data-testid={testid}
      className={`${CARD} flex flex-col items-center gap-3 px-4 py-6`}
    >
      <span
        aria-hidden
        className="h-5 w-5 animate-spin rounded-full border-2 border-transparent border-t-accent"
      />
      <span className="text-base text-text2">{caption}</span>
    </div>
  )
}
