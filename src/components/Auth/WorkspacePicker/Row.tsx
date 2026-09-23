import { DropdownItem } from '@/components/elements/Dropdown'
import Monogram from '@/components/elements/Monogram'
import { CheckGlyph } from '@/components/Main/icons'
import { chord } from '@/lib/platform'

interface Props {
  id: string
  label: string
  // Its size and where it lives, already translated ("284 items · Google Drive").
  about: string
  // Its place in the full list, which is what its chord is numbered by.
  position: number
  selected: boolean
  lit: boolean
  onLight: () => void
  onPick: () => void
}

// One vault: its tile, its name over its size and where it lives, and at the
// end either the check of the one open or the chord that opens it (⌘1–⌘9).
export default function Row({ id, label, about, position, selected, lit, onLight, onPick }: Props) {
  return (
    <DropdownItem
      testid={`workspace-option-${id}`}
      checked={selected}
      active={lit}
      onMouseEnter={onLight}
      onFocus={onLight}
      onClick={onPick}
      className="py-[7px]"
    >
      <Monogram name={label} seed={id} size={32} fontSize={14} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
        <span className="truncate text-[13.5px] font-medium text-text">{label}</span>
        <span className="truncate text-[12px] text-text2">{about}</span>
      </span>
      {selected ? (
        <span className="grid flex-none place-items-center text-accent">
          <CheckGlyph stroke={1.6} />
        </span>
      ) : (
        position < 9 && (
          // A finger has no ⌘, so no coarse pointer is shown one.
          <span aria-hidden className="flex-none font-mono text-xs text-text3 any-pointer-coarse:hidden">
            {chord(String(position + 1))}
          </span>
        )
      )}
    </DropdownItem>
  )
}
