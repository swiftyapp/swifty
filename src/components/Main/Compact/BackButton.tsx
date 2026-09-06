import { BackGlyph } from '../icons'

interface Props {
  /**
   * Where this goes, not the word "Back": iOS names the previous screen, so the
   * caller passes the title that screen draws itself with.
   */
  label: string
  testid: string
  onClick: () => void
}

// The leading control of a pushed screen's `NavBar`. Capped at 160px so a long
// list title truncates rather than pushing the trailing actions off the row.
export default function BackButton({ label, testid, onClick }: Props) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className="flex h-14 min-w-11 cursor-pointer items-center gap-0.5 pr-2 text-accent"
    >
      <BackGlyph />
      <span className="max-w-[160px] truncate text-md">{label}</span>
    </button>
  )
}
