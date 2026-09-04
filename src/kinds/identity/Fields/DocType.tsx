import { useTranslation } from 'react-i18next'
import Segmented from '@/components/elements/Segmented'
import { DOC_TYPES, DOC_TYPE_LABELS, type DocType } from '../templates'

interface Props {
  value: DocType
  onChange: (next: DocType) => void
}

// Which document this is. The whole form is derived from it, so it sits above
// the panel rather than inside it as one more row. Editing only: reading, there
// is nothing to choose and the eyebrow already names the document.
export default function DocTypeRow({ value, onChange }: Props) {
  const { t } = useTranslation()

  return (
    <Segmented
      options={DOC_TYPES.map(type => ({ value: type, label: t(DOC_TYPE_LABELS[type]) }))}
      value={value}
      onChange={onChange}
      name={t('Document type')}
      testidPrefix="identity-doc-type"
      className="w-fit"
    />
  )
}
