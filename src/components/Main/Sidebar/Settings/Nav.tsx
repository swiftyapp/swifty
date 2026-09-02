import { cx } from '@/utils/cx'
import { t } from '@/i18n'
import type { Section } from '@/store/uiSlice'
import Footer from './Footer'
import { SECTIONS } from './sections'

interface Props {
  section: Section
  onSelect: (section: Section) => void
}

export default function Nav({ section, onSelect }: Props) {
  return (
    <nav className="flex w-[220px] flex-none flex-col border-r border-line bg-list p-5">
      <div className="mb-4 text-xl font-semibold tracking-display text-text">
        {t('Settings')}
      </div>
      <ul className="m-0 flex flex-1 flex-col gap-0.5 overflow-y-auto p-0">
        {SECTIONS.map(({ key, label, Glyph }) => {
          const active = key === section
          return (
            <li key={key}>
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                data-testid={`settings-nav-${key}`}
                onClick={() => onSelect(key)}
                className={cx(
                  'relative flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-left text-base transition-colors',
                  active
                    ? 'bg-tile text-text'
                    : 'text-text2 hover:bg-hover hover:text-text'
                )}
              >
                <Glyph size={16} />
                <span className="min-w-0 flex-1 truncate">{t(label)}</span>
                {active && (
                  <span className="absolute right-1.5 h-4 w-0.5 rounded-full bg-accent" />
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <Footer />
    </nav>
  )
}
