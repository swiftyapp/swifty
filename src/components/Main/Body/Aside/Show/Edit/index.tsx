import type { Entry, EntryType } from '@/lib/commands'
import { kindOf } from '@/kinds'
import { useTranslation } from 'react-i18next'
import { FieldsProvider } from '@/components/elements/fields'
import { MONO_TYPE } from '@/components/elements/tokens'
import Actions from './Actions'
import Footer from '../Footer'
import { useDraft } from './useDraft'

interface Props {
  /** The kind being written: a new entry's chosen kind, or the entry's own. */
  type: EntryType
  /** The decrypted entry, or null for a new one (and while the reveal is in flight). */
  revealed: Entry | null
}

// Editing happens in the detail pane, in the read view's own layout: same
// eyebrow, same title line, same rows in the same places. What changes is the
// state — an accent frame around the pane, an accent eyebrow, and a title you
// can type in — so there is never a doubt about which mode this is.
export default function Edit({ type, revealed }: Props) {
  const { t } = useTranslation()
  const draft = useDraft(type, revealed)
  const kind = kindOf(type)
  const Glyph = kind.Glyph
  const Fields = kind.Fields
  const title = typeof draft.model.title === 'string' ? draft.model.title : ''
  // A draft array is not necessarily strings (a login also carries passkeys),
  // so narrow rather than assume the key holds tags.
  const raw = draft.model.tags
  const tags = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : []

  return (
    <div className="mx-auto w-full max-w-sheet">
      {/* Negative margin cancels the frame's padding, so the content sits
          exactly where the read view puts it. */}
      <div
        data-testid="entry-sheet"
        className="-m-4 rounded-xl border border-accent-line p-4"
      >
        {/* The eyebrow shares its line with the actions, so the title input below
            runs the full content width and its underline ends where the rows do. */}
        <div className="flex items-center justify-between gap-4">
          <div
            className={`flex min-w-0 flex-1 items-center gap-2 truncate whitespace-nowrap ${MONO_TYPE} text-accent`}
          >
            <span>{t('Editing')}</span>
            <span>·</span>
            <span>{t(kind.label)}</span>
          </div>
          <Actions draft={draft} />
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          <div className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-accent-soft text-accent">
            <Glyph size={16} />
          </div>
          <input
            name="title"
            value={title}
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
            placeholder={t(kind.untitledLabel)}
            onChange={event => draft.set('title', event.target.value)}
            className="min-w-0 flex-1 truncate border-b border-line2 bg-transparent text-2xl font-semibold tracking-display text-text outline-none transition-colors placeholder:text-text3 focus:border-accent-line"
          />
        </div>
        {/* Every kind requires a title, so the pane owns this one message. */}
        {draft.attempted && !title.trim() && (
          <div className="mt-1.5 pl-[38px] text-base text-bad">{t('Required')}</div>
        )}

        <div className="mt-5">
          <FieldsProvider
            value={{ entry: draft.model, set: draft.set, attempted: draft.attempted }}
          >
            <Fields />
          </FieldsProvider>
        </div>

        {/* The read view's footer, with the tags open for editing. A new entry
            has no dates yet, so its footer is the tags cell alone. */}
        <Footer
          tags={tags}
          onTags={next => draft.set('tags', next)}
          createdAt={revealed?.createdAt ?? revealed?.created_at}
          updatedAt={revealed?.updatedAt ?? revealed?.updated_at}
        />

        {draft.saveError && (
          <div
            data-testid="entry-save-error"
            className="mt-4 rounded-lg border border-bad/40 bg-bad/5 px-4 py-3 text-base text-bad"
          >
            {draft.saveError}
          </div>
        )}
      </div>
    </div>
  )
}
