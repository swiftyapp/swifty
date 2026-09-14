import { useTranslation } from 'react-i18next'
import IconButton from '@/components/elements/IconButton'
import Segmented from '@/components/elements/Segmented'
import { FieldRow, useField } from '@/components/elements/fields'
import { CloseGlyph } from '@/components/Main/icons'
import { ENVIRONMENT_LABELS, ENVIRONMENTS, environmentOf } from '../environment'

// Which environment the key is honoured in. A switch rather than a text row —
// there are two answers — and the editor's alone: read, the environment is the
// eyebrow over the title and a cell on the face, and needs no third saying.
// The environment is optional, so a set one can be cleared again: a slip of
// the switch must not leave PRODUCTION over a key that is nothing of the kind.
export default function Environment() {
  const { t } = useTranslation()
  const { value, set, editing } = useField('environment')
  const environment = environmentOf(value)

  if (!editing) return null

  return (
    <FieldRow
      label="Environment"
      actions={
        environment && (
          <IconButton title={t('Clear')} testid="clear-environment" onClick={() => set('')}>
            <CloseGlyph />
          </IconButton>
        )
      }
    >
      {() => (
        <Segmented
          options={ENVIRONMENTS.map(environment => ({
            value: environment,
            label: t(ENVIRONMENT_LABELS[environment])
          }))}
          // Unset, or a value the two do not name, lights no segment.
          value={environment ?? ''}
          onChange={set}
          name={t('Environment')}
          testidPrefix="apikey-environment"
          className="w-fit"
        />
      )}
    </FieldRow>
  )
}
