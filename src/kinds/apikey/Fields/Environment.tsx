import { useTranslation } from 'react-i18next'
import Segmented from '@/components/elements/Segmented'
import { FieldRow, useField } from '@/components/elements/fields'
import { ENVIRONMENT_LABELS, ENVIRONMENTS, environmentOf } from '../environment'

// Which environment the key is honoured in. A switch rather than a text row —
// there are two answers — and the editor's alone: read, the environment is the
// eyebrow over the title and a cell on the face, and needs no third saying.
export default function Environment() {
  const { t } = useTranslation()
  const { value, set, editing } = useField('environment')

  if (!editing) return null

  return (
    <FieldRow label="Environment">
      {() => (
        <Segmented
          options={ENVIRONMENTS.map(environment => ({
            value: environment,
            label: t(ENVIRONMENT_LABELS[environment])
          }))}
          // Unset, or a value the two do not name, lights no segment.
          value={environmentOf(value) ?? ''}
          onChange={set}
          name={t('Environment')}
          testidPrefix="apikey-environment"
          className="w-fit"
        />
      )}
    </FieldRow>
  )
}
