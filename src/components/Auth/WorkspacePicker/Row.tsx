import { DropdownCheck, DropdownItem, DropdownMeta } from '@/components/elements/Dropdown'
import Monogram from '@/components/elements/Monogram'
import { chord } from '@/lib/platform'

interface Props {
  id: string
  // The row's element id, which the search field's `aria-activedescendant`
  // names while this row is the lit one.
  domId: string
  // An option of the search field's listbox rather than an item of a menu.
  option: boolean
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
export default function Row({
  id,
  domId,
  option,
  label,
  about,
  position,
  selected,
  lit,
  onLight,
  onPick
}: Props) {
  return (
    <DropdownItem
      id={domId}
      option={option}
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
        <DropdownCheck on />
      ) : (
        position < 9 && <DropdownMeta hint>{chord(String(position + 1))}</DropdownMeta>
      )}
    </DropdownItem>
  )
}
