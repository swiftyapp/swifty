import { t } from '@/i18n'

interface Props {
  tags: string[]
}

export default function Empty({ tags }: Props) {
  if (tags.length !== 0) return null
  return <div className="dropdown-empty">{t('Start tagging')}</div>
}
