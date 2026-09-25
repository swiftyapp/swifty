import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '@/i18n'
import { Dropdown, DropdownCheck, DropdownItem } from '@/components/elements/Dropdown'
import { META } from '@/components/elements/tokens'
import { ChevronDownGlyph } from '@/components/Main/icons'

// The locale picker: a field-shaped trigger naming the current language in its
// own tongue, opening a single-select menu of the rest. Switching applies at
// once — the catalogue is fetched on demand and the UI re-renders under it.
export default function LanguageMenu() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const current = i18n.resolvedLanguage ?? ''

  const pick = (locale: string) => {
    setOpen(false)
    void i18n.changeLanguage(locale)
  }

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="settings-locale-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('Language')}: ${LANGUAGES[current] ?? current}`}
        onClick={() => setOpen(value => !value)}
        className="flex h-9 w-[236px] cursor-pointer items-center gap-2 rounded-sm border border-line2 bg-field px-3 text-base font-medium text-text transition-colors hover:border-accent-line"
      >
        <span className="min-w-0 flex-1 truncate text-left">{LANGUAGES[current] ?? current}</span>
        <span className={META}>{current}</span>
        <ChevronDownGlyph className="flex-none text-text2" />
      </button>
      {open && (
        <Dropdown onBlur={() => setOpen(false)} className="right-0 top-10 w-[260px]">
          {Object.keys(LANGUAGES).map(key => (
            <DropdownItem
              key={key}
              checked={key === current}
              testid={`settings-locale-${key}`}
              onClick={() => pick(key)}
            >
              <span className="min-w-0 flex-1 truncate text-text">{LANGUAGES[key]}</span>
              <span className={META}>{key}</span>
              <DropdownCheck on={key === current} />
            </DropdownItem>
          ))}
        </Dropdown>
      )}
    </div>
  )
}
