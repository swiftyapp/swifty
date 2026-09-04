import { useTranslation } from 'react-i18next'
import { setFilterQuery } from '@/store'
import TagsInput from '../TagsInput'
import { MONO_LABEL } from '../tokens'
import { TAG_CHIP } from './chip'
import { useFields } from './context'

// Tags sit below the panel in both modes, on the panel rows' own geometry —
// label 128 + gap 12 + sigil 16 + gap 12 — so the first chip starts at the same
// x as every value above it.
export default function TagsField({ name = 'tags' }) {
  const { t } = useTranslation()
  const { entry, set } = useFields()
  const raw = entry[name]
  // A draft array is not necessarily strings (a login also carries passkeys),
  // so narrow rather than assume the key holds tags.
  const tags = Array.isArray(raw) ? raw.filter(v => typeof v === 'string') : []

  if (!set && tags.length === 0) return null

  return (
    <div className="mt-4 flex items-center gap-3 px-3.5">
      <span className={`w-32 flex-none ${MONO_LABEL}`}>{t('Tags')}</span>
      {/* The sigil column the rows hold open, empty here. */}
      <span className="w-4 flex-none" />
      <div className="min-w-0 flex-1">
        {set ? (
          <TagsInput
            value={tags}
            onChange={next => set(name, next)}
            placeholder={t('Add tag')}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
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
      </div>
    </div>
  )
}
