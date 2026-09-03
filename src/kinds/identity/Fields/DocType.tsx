import { useTranslation } from 'react-i18next'
import Segmented from '@/components/elements/Segmented'
import { MONO_LABEL } from '@/components/elements/tokens'
import { DOC_TYPES, DOC_TYPE_LABELS, type DocType } from '../templates'

interface Props {
  value: DocType
  onChange: (next: DocType) => void
  editing: boolean
}

// Which document this is. The whole form is derived from it, so it sits above
// the panel rather than inside it as one more row — and reading, where there is
// nothing to choose, it collapses to the label it settled on.
export default function DocTypeRow({ value, onChange, editing }: Props) {
  const { t } = useTranslation()

  if (!editing)
    return (
      <div className={MONO_LABEL} data-testid="entry-value-doc_type">
        {t(DOC_TYPE_LABELS[value])}
      </div>
    )

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
