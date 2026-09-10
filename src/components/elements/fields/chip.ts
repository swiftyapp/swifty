import { META_TYPE } from '../tokens'

// One tag chip, shared by the read row and the editor so a tag looks the same
// before and after it is committed.
export const TAG_CHIP = `flex h-6 cursor-pointer items-center rounded-sm border border-line2 px-2.5 ${META_TYPE} text-text2 transition-colors`
