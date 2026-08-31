import { cx } from '@/utils/cx'
import { t } from '@/i18n'

export type Section =
  | 'vault'
  | 'import'
  | 'masterpassword'
  | 'biometric'
  | 'password'
  | 'audit'
  | 'language'
  | 'updates'

interface Props {
  section: Section
  onClick: (section: Section) => void
}

const items: { key: Section; label: string }[] = [
  { key: 'vault', label: 'Vault Settings' },
  { key: 'import', label: 'Import Vault' },
  { key: 'masterpassword', label: 'Master Password' },
  { key: 'biometric', label: 'Biometric Unlock' },
  { key: 'password', label: 'Password Generation' },
  { key: 'audit', label: 'Password Audit' },
  { key: 'language', label: 'Language' },
  { key: 'updates', label: 'Updates' }
]

export default function Navigation({ section, onClick }: Props) {
  return (
    <ul className="navigation m-0 flex w-[200px] flex-none flex-col gap-1 overflow-y-auto border-r border-line bg-list p-3">
      {items.map(item => (
        <li
          key={item.key}
          onClick={() => onClick(item.key)}
          className={cx(
            'cursor-pointer rounded-sm px-3 py-2 text-[13px] transition-colors',
            section === item.key
              ? 'bg-accent-soft font-medium text-accent'
              : 'text-text2 hover:bg-hover hover:text-text'
          )}
        >
          {t(item.label)}
        </li>
      ))}
    </ul>
  )
}
