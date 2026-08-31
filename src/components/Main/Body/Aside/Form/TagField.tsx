import type { EntryDraft } from '@/defaults/entries'
import { t } from '@/i18n'
import TagsInput from '@/components/elements/TagsInput'
import { labelClass } from '@/components/elements/formStyles'

interface Props {
  entry: EntryDraft
  onChange: (tags: string[]) => void
}

export default function TagField({ entry, onChange }: Props) {
  return (
    <div>
      <label className={labelClass}>{t('Tags')}</label>
      <TagsInput value={entry.tags ?? []} onChange={onChange} />
    </div>
  )
}
