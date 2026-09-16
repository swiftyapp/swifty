import { META_TYPE } from '@/components/elements/tokens'

interface Props {
  children: string
  onClick: () => void
  testid?: string
}

// A way out that is not the point of the screen — switching account, reaching
// for the other kind of backup. Muted text, no chrome: a third button here
// would read as a third equal choice.
export default function TextLink({ children, onClick, testid }: Props) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className={`cursor-pointer border-0 bg-transparent ${META_TYPE} text-text2 transition-colors hover:text-text`}
    >
      {children}
    </button>
  )
}
