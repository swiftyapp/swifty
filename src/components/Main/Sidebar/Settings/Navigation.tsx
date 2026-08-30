import { cx } from '@/utils/cx'
import { t } from '@/i18n'

export type Section = 'vault' | 'masterpassword' | 'password' | 'language'

interface Props {
  section: Section
  onClick: (section: Section) => void
}

const items: { key: Section; label: string }[] = [
  { key: 'vault', label: 'Vault Settings' },
  { key: 'masterpassword', label: 'Master Password' },
  { key: 'password', label: 'Password Generation' },
  { key: 'language', label: 'Language' }
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
