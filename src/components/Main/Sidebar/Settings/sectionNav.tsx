import { createContext, useContext } from 'react'
import { setSettingsSection, type Section } from '@/store'

/**
 * How a section body moves Settings to another section, whichever shell it is
 * drawn in. The wide modal's section lives in the store, so the default is
 * the store's own setter; the phone keeps its pushed section in local state
 * and provides its own (see `Compact/Settings`). A body that only called the
 * store would move the modal nobody is looking at.
 */
const SectionNavContext = createContext<(section: Section) => void>(setSettingsSection)

export const SectionNavProvider = SectionNavContext.Provider

export const useSectionNav = () => useContext(SectionNavContext)
