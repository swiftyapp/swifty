import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TKey } from '@/i18n'
import { setFilterQuery } from '@/store'
import TagsInput from '@/components/elements/TagsInput'
import { TAG_CHIP } from '@/components/elements/fields/chip'
import { MONO_LABEL } from '@/components/elements/tokens'
import { dateTime, relativeLong, shortDate, toTime } from '@/utils/time'

interface Props {
  tags: string[]
  /** Editing: writes the tags back. Absent while reading. */
  onTags?: (next: string[]) => void
  createdAt?: string
  updatedAt?: string
  deletedAt?: string
}

type Stamp = [label: TKey, iso: string, spell: (iso: string) => string]

// Creation is a fact, so it reads as a date; a modification is about recency,
// so it reads as how long ago (and as a date once that stops being useful).
const absolute = (iso: string): string => {
  const at = toTime(iso)
  return at === null ? '' : shortDate(at)
}

const stamp = (label: TKey, iso: string | undefined, spell: Stamp[2]): Stamp | null =>
  iso ? [label, iso, spell] : null

// The pane's footer, the same in both modes: what the entry is filed under, and
// when it was made and last touched. Secondary by design — a hairline away from
// the content, a small label over each value — but structured, so it never
// reads as a sentence tacked on under the rows. Tags take the left, where the
// title sits in the header; the timestamps hold the right, under the header's
// actions, and stay there whether or not there are tags.
export default function Footer({ tags, onTags, createdAt, updatedAt, deletedAt }: Props) {
  const { t } = useTranslation()
  const stamps = [
    stamp('Deleted', deletedAt, relativeLong),
    stamp('Modified', updatedAt, relativeLong),
    stamp('Created', createdAt, absolute)
  ].filter((entry): entry is Stamp => entry !== null)
  // Reading, no tags is no cell; editing, the cell is where tags get added.
  const filed = !!onTags || tags.length > 0

  if (!filed && stamps.length === 0) return null

  return (
    <footer
      data-testid="entry-footer"
      className="mt-5 flex items-start gap-10 border-t border-line pt-4"
    >
      {filed && (
        <Cell label="Tags" className="min-w-0 flex-1">
          {onTags ? (
            <TagsInput value={tags} onChange={onTags} placeholder={t('Add tag')} />
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setFilterQuery(tag)}
                  aria-label={t('Filter by tag {{tag}}', { tag })}
                  className={`${TAG_CHIP} hover:text-text`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </Cell>
      )}
      {stamps.length > 0 && (
        <div className="ml-auto flex flex-none gap-10">
          {stamps.map(([label, iso, spell]) => (
            <Cell key={label} label={label} className="text-right">
              <span title={dateTime(iso)}>{spell(iso)}</span>
            </Cell>
          ))}
        </div>
      )}
    </footer>
  )
}

// One footer cell: the mono micro-label over the value, the way the rows pair
// theirs — only stacked, since the footer is a strip rather than a column. The
// value is a tier up from the label (base over xs, as in the rows): uppercase
// and tracking make an 11px label read larger than it is, so at the same size
// it was the label that drew the eye. Secondary stays a matter of ink.
function Cell({
  label,
  className,
  children
}: {
  label: TKey
  className?: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className={className}>
      <div className={MONO_LABEL}>{t(label)}</div>
      <div className="mt-1 font-mono text-base text-text2">{children}</div>
    </div>
  )
}
