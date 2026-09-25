import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { EntryType } from '@/api/types'
import { setFilterType } from '@/store'
import { kindOf } from '@/kinds'
import { cx } from '@/utils/cx'
import { LABEL, META_TYPE } from '@/components/elements/tokens'
import { ChevronRightGlyph } from '../../icons'

interface Props {
  type: EntryType
  count: number
  door: boolean
  children: ReactNode
}

export default function Section({ type, count, door, children }: Props) {
  const { t } = useTranslation()
  const id = useId()
  const kind = kindOf(type)

  const shell = cx(
    'sticky top-0 z-10 flex h-8 w-full items-center gap-1.5 bg-list px-4 max-md:bg-screen',
    LABEL
  )
  const content = (
    <>
      <span id={id} className="truncate">
        {t(kind.pluralLabel)}
      </span>
      <span className={`${META_TYPE} opacity-60`}>{count}</span>
      {door && (
        <span className="ml-auto text-text3 opacity-0 transition-opacity group-hover/gh:opacity-100">
          <ChevronRightGlyph size={14} />
        </span>
      )}
    </>
  )

  return (
    <div role="group" aria-labelledby={id}>
      {door ? (
        <button
          type="button"
          tabIndex={-1}
          data-testid={`group-${type}`}
          onClick={() => setFilterType(type)}
          className={cx(shell, 'group/gh cursor-pointer text-left hover:text-text')}
        >
          {content}
        </button>
      ) : (
        <div data-testid={`group-${type}`} className={shell}>
          {content}
        </div>
      )}
      {children}
    </div>
  )
}
