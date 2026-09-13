import { META_TYPE } from '../tokens'

// One chip — a tag, a scope: a short word in a hairline box at the meta size.
export const CHIP = `flex h-6 items-center rounded-sm border border-line2 px-2.5 ${META_TYPE} text-text2 transition-colors`

// One tag chip, shared by the read row and the editor so a tag looks the same
// before and after it is committed. A tag does something when pressed.
export const TAG_CHIP = `${CHIP} cursor-pointer`
