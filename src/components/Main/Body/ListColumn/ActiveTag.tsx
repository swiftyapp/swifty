import { useTranslation } from 'react-i18next'
import { useUi, setView } from '@/store'
import { CloseGlyph } from '../../icons'
import { META_TYPE } from '@/components/elements/tokens'

export default function ActiveTag() {
  const { t } = useTranslation()
  const tag = useUi(state => (state.view === 'tags' ? state.filterTag : null))
  if (!tag) return null

  return (
    <div className="mt-2 flex">
      <button
        type="button"
        data-testid="active-tag"
        title={t('Clear tag filter')}
        onClick={() => setView('items')}
        className={`flex h-6 flex-none items-center gap-1.5 rounded-sm border border-accent-line bg-accent-soft px-[9px] ${META_TYPE} whitespace-nowrap text-accent max-md:h-8 max-md:rounded-full max-md:border-text max-md:bg-text max-md:px-3 max-md:text-base max-md:font-medium max-md:text-screen`}
      >
        <span>#{tag}</span>
        <span className="opacity-60">
          <CloseGlyph size={12} />
        </span>
      </button>
    </div>
  )
}
