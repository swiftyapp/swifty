import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Panel from '@/components/elements/Panel'
import Segmented from '@/components/elements/Segmented'
import IconButton from '@/components/elements/IconButton'
import { NoteField, useField } from '@/components/elements/fields'
import { META } from '@/components/elements/tokens'
import { EyeGlyph, EyeOffGlyph } from '@/components/Main/icons'
import { parseEnv, varsOf } from '../parse'
import FileTab from './FileTab'
import Table from './Table'

type Tab = 'variables' | 'file'

// The file is the entry's one secret; the table is a view over it. Two faces
// share the same draft key, so switching tabs never has anything to sync — the
// File tab shows what the rows were parsed from, and edits on either side land
// in the same string.
export default function Fields() {
  const { t } = useTranslation()
  const { value: body, editing } = useField('body')
  const { value: note } = useField('note')
  const [tab, setTab] = useState<Tab>('variables')
  const [showAll, setShowAll] = useState(false)
  const count = varsOf(parseEnv(body)).length
  const variables = tab === 'variables'

  return (
    <>
      {/* Compact keeps the two segments side by side; the count and the eye
          drop under them. */}
      <div className="mb-3 flex items-center justify-between gap-3 @max-[420px]:flex-wrap">
        <Segmented
          options={[
            { value: 'variables', label: t('Variables') },
            { value: 'file', label: t('File') }
          ]}
          value={tab}
          onChange={setTab}
          testidPrefix="env-tab"
        />
        <div className="flex items-center gap-2 @max-[420px]:w-full @max-[420px]:justify-end">
          <span className={META}>{t('{{count}} variables', { count })}</span>
          {/* One eye for the whole panel, mirroring the card face. Editing
              starts revealed, so it has nothing to do there. */}
          {variables && !editing && (
            <IconButton
              title={showAll ? t('Hide') : t('Reveal')}
              active={showAll}
              testid="env-reveal-all"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? <EyeOffGlyph /> : <EyeGlyph />}
            </IconButton>
          )}
        </div>
      </div>

      {/* Keyed on the mode so the table's session state — which rows are
          revealed, the filter, a row being added — starts clean on each
          switch. Reading after an edit re-masks everything, which is the safe
          way round. */}
      {variables ? <Table key={editing ? 'edit' : 'read'} revealAll={showAll} /> : <FileTab />}

      {/* Reading, an empty note is no panel at all — like the card's aside. */}
      {(editing || note !== '') && (
        <Panel className="mt-3">
          <NoteField label="Note" />
        </Panel>
      )}
    </>
  )
}
