import type { DocType } from '../templates'

/**
 * The colours one document face is printed in.
 *
 * Fixed hex, never theme tokens: a face stands for a physical object, so it
 * keeps its own paper and ink in both themes — the same reason the credit card
 * face is graphite in light mode too.
 */
export interface Palette {
  /** The paper: a two-stop gradient, light like the real thing. */
  paper: string
  /** Body ink, and the quieter ink the labels and glosses take. */
  ink: string
  ink2: string
  /** The header band (a card) or the cover (a passport), and its print. */
  band: string
  bandInk: string
  /** The guilloche rings, drawn at low alpha over the paper. */
  guilloche: string
}

/** Every document that is a card in the wallet rather than a booklet. */
export type CardType = Exclude<DocType, 'passport'>

// Each card takes the paper its real counterpart is most often printed on: an
// EU licence is pink, a polycarbonate ID card cool white, a permit greenish.
export const CARD_PALETTES: Record<CardType, Palette> = {
  id_card: {
    paper: 'linear-gradient(150deg, #F3F6FA, #DBE3ED 62%)',
    ink: '#18243A',
    ink2: '#5D6C82',
    band: '#1F3A5F',
    bandInk: '#E9EFF7',
    guilloche: 'rgba(31, 58, 95, 0.10)'
  },
  driver_license: {
    paper: 'linear-gradient(150deg, #FBF0F2, #EDD6DB 62%)',
    ink: '#3A1E27',
    ink2: '#7C5C66',
    band: '#8C2F45',
    bandInk: '#FBF0F2',
    guilloche: 'rgba(140, 47, 69, 0.10)'
  },
  residence_permit: {
    paper: 'linear-gradient(150deg, #EFF5F1, #D7E3DA 62%)',
    ink: '#1C2E27',
    ink2: '#5F746B',
    band: '#2E5E4E',
    bandInk: '#EEF5F0',
    guilloche: 'rgba(46, 94, 78, 0.10)'
  },
  other: {
    paper: 'linear-gradient(150deg, #F4F3F0, #E0DED8 62%)',
    ink: '#23262B',
    ink2: '#6C717A',
    band: '#3B3F46',
    bandInk: '#F1F1EE',
    guilloche: 'rgba(59, 63, 70, 0.10)'
  }
}

/**
 * Passport covers come in four colours the world over, and gold is printed on
 * all of them. Burgundy is the default: it is the EU's, and the most common.
 */
const COVERS = {
  burgundy: '#5B1F2D',
  navy: '#1B2A4A',
  green: '#1F4D3A',
  black: '#17181C'
} as const

type Cover = keyof typeof COVERS

const COVER_OF: Record<string, Cover> = Object.fromEntries([
  ...'USA CAN AUS GBR IND UKR ISR ARG BRA URY ARE KAZ'.split(' ').map(code => [code, 'navy']),
  ...'SAU PAK MAR NGA IDN BGD EGY IRN DZA MEX'.split(' ').map(code => [code, 'green']),
  ['NZL', 'black']
])

/** The cover colour the issuing country binds its passports in. */
export const coverOf = (country: string): string =>
  COVERS[COVER_OF[country.trim().toUpperCase()] ?? 'burgundy']

const PASSPORT_PAGE = {
  paper: 'linear-gradient(150deg, #F6F2E9, #E8E1D2 62%)',
  ink: '#241E17',
  ink2: '#77705F',
  bandInk: '#D9BC66',
  guilloche: 'rgba(184, 150, 62, 0.14)'
}

/** A passport's data page, bound in the cover its country uses. */
export const passportPalette = (country: string): Palette => ({
  ...PASSPORT_PAGE,
  band: coverOf(country)
})
