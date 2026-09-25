import { useTranslation } from 'react-i18next'
import type { EntryType } from '@/api/types'
import { showKind } from '@/store'
import { kindOf } from '@/kinds'
import { cx } from '@/utils/cx'
import { LABEL, META_TYPE } from '@/components/elements/tokens'
import { ChevronRightGlyph } from '../../icons'

interface Props {
  type: EntryType
  count: number
  /** Names the section for the listbox group it heads. */
  id: string
  /**
   * Whether the header is a way into the kind. In All Items a kind is a place
   * under the list, so its header is the door; in Favorites, the Archive and a
   * tag it only names the section — leaving those for All Items on a click
   * would be a bigger move than a caption should make.
   */
  door: boolean
}

// The sticky caption over one kind's rows in a grouped list: "Credit cards · 3".
// It sits on the column's ground so rows scroll under it, not through it.
export default function GroupHeader({ type, count, id, door }: Props) {
  const { t } = useTranslation()
  const kind = kindOf(type)

  const content = (
    <>
      <span id={id} className="truncate">
        {t(kind.pluralLabel)}
      </span>
      <span className={`${META_TYPE} opacity-60`}>{count}</span>
      {door && (
        <span className="ml-auto text-text3 opacity-0 transition-opacity group-hover/gh:opacity-100">
          <ChevronRightGlyph size={14} />
        </span>
      )}
    </>
  )

  const shell = cx(
    'sticky top-0 z-10 flex h-8 w-full items-center gap-1.5 bg-list px-4 max-md:bg-screen',
    LABEL
  )

  // A caption that opens a place is a button; one that only names a section is
  // text. Same shell either way, so the two read as one thing.
  return door ? (
    <button
      type="button"
      data-testid={`group-${type}`}
      title={t(kind.pluralLabel)}
      onClick={() => showKind(type)}
      className={cx(shell, 'group/gh cursor-pointer text-left hover:text-text')}
    >
      {content}
    </button>
  ) : (
    <div data-testid={`group-${type}`} className={shell}>
      {content}
    </div>
  )
}
