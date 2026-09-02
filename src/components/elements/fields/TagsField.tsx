import { setFilterQuery } from '@/store'
import { t } from '@/i18n'
import TagsInput from '../TagsInput'
import { MONO_LABEL } from '../tokens'
import { TAG_CHIP } from './chip'
import { useFields } from './context'

// Tags sit below the panel in both modes: a label column would waste the row
// on what is already the widest thing on the line.
export default function TagsField({ name = 'tags' }) {
  const { entry, set } = useFields()
  const raw = entry[name]
  const tags = Array.isArray(raw) ? raw : []

  if (!set && tags.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className={`mr-1 ${MONO_LABEL}`}>{t('Tags')}</span>
      {set ? (
        <div className="min-w-0 flex-1">
          <TagsInput value={tags} onChange={next => set(name, next)} />
        </div>
      ) : (
        tags.map(tag => (
          <button
            key={tag}
            type="button"
            onClick={() => setFilterQuery(tag)}
            aria-label={`${t('Filter by tag')} ${tag}`}
            className={`${TAG_CHIP} hover:text-text`}
          >
            {tag}
          </button>
        ))
      )}
    </div>
  )
}
