import type { ChangeEvent } from 'react'
import type { EntryDraft } from '@/defaults/entries'

export type FieldChange = ChangeEvent<HTMLInputElement | HTMLTextAreaElement>

export const valueOf = (entry: EntryDraft, name: string): string =>
  typeof entry[name] === 'string' ? (entry[name] as string) : ''
