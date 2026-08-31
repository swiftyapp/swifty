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
    <ul className="navigation">
      {items.map(item => (
        <li
          key={item.key}
          className={cx({ current: section === item.key })}
          onClick={() => onClick(item.key)}
        >
          {t(item.label)}
        </li>
      ))}
    </ul>
  )
}
