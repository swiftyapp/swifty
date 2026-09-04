import { getLocale } from '@/i18n'

/**
 * ISO 3166-1 alpha-3 → alpha-2, and the country name that follows from it.
 *
 * A travel document prints the alpha-3 code (`UKR`), which is what gets stored
 * and copied; `Intl.DisplayNames` only speaks alpha-2, so the read view needs
 * this table to name the country in the user's language.
 *
 * All 249 officially assigned codes, as `<alpha-3><alpha-2>` tokens.
 */
const CODES =
  `ABWAW AFGAF AGOAO AIAAI ALAAX ALBAL ANDAD AREAE ARGAR ARMAM ASMAS ATAAQ ATFTF ATGAG
   AUSAU AUTAT AZEAZ BDIBI BELBE BENBJ BESBQ BFABF BGDBD BGRBG BHRBH BHSBS BIHBA BLMBL
   BLRBY BLZBZ BMUBM BOLBO BRABR BRBBB BRNBN BTNBT BVTBV BWABW CAFCF CANCA CCKCC CHECH
   CHLCL CHNCN CIVCI CMRCM CODCD COGCG COKCK COLCO COMKM CPVCV CRICR CUBCU CUWCW CXRCX
   CYMKY CYPCY CZECZ DEUDE DJIDJ DMADM DNKDK DOMDO DZADZ ECUEC EGYEG ERIER ESHEH ESPES
   ESTEE ETHET FINFI FJIFJ FLKFK FRAFR FROFO FSMFM GABGA GBRGB GEOGE GGYGG GHAGH GIBGI
   GINGN GLPGP GMBGM GNBGW GNQGQ GRCGR GRDGD GRLGL GTMGT GUFGF GUMGU GUYGY HKGHK HMDHM
   HNDHN HRVHR HTIHT HUNHU IDNID IMNIM INDIN IOTIO IRLIE IRNIR IRQIQ ISLIS ISRIL ITAIT
   JAMJM JEYJE JORJO JPNJP KAZKZ KENKE KGZKG KHMKH KIRKI KNAKN KORKR KWTKW LAOLA LBNLB
   LBRLR LBYLY LCALC LIELI LKALK LSOLS LTULT LUXLU LVALV MACMO MAFMF MARMA MCOMC MDAMD
   MDGMG MDVMV MEXMX MHLMH MKDMK MLIML MLTMT MMRMM MNEME MNGMN MNPMP MOZMZ MRTMR MSRMS
   MTQMQ MUSMU MWIMW MYSMY MYTYT NAMNA NCLNC NERNE NFKNF NGANG NICNI NIUNU NLDNL NORNO
   NPLNP NRUNR NZLNZ OMNOM PAKPK PANPA PCNPN PERPE PHLPH PLWPW PNGPG POLPL PRIPR PRKKP
   PRTPT PRYPY PSEPS PYFPF QATQA REURE ROURO RUSRU RWARW SAUSA SDNSD SENSN SGPSG SGSGS
   SHNSH SJMSJ SLBSB SLESL SLVSV SMRSM SOMSO SPMPM SRBRS SSDSS STPST SURSR SVKSK SVNSI
   SWESE SWZSZ SXMSX SYCSC SYRSY TCATC TCDTD TGOTG THATH TJKTJ TKLTK TKMTM TLSTL TONTO
   TTOTT TUNTN TURTR TUVTV TWNTW TZATZ UGAUG UKRUA UMIUM URYUY USAUS UZBUZ VATVA VCTVC
   VENVE VGBVG VIRVI VNMVN VUTVU WLFWF WSMWS YEMYE ZAFZA ZMBZM ZWEZW`

const ALPHA2: Record<string, string> = Object.fromEntries(
  CODES.split(/\s+/).map(code => [code.slice(0, 3), code.slice(3)])
)

// `Intl.DisplayNames` is not free to construct, and every identity row asks for
// the same locale.
const names = new Map<string, Intl.DisplayNames>()

const displayNames = (locale: string): Intl.DisplayNames | undefined => {
  const cached = names.get(locale)
  if (cached) return cached
  try {
    const made = new Intl.DisplayNames([locale], { type: 'region' })
    names.set(locale, made)
    return made
  } catch {
    return undefined
  }
}

/**
 * The localized country name for an alpha-3 code, or undefined for anything
 * that is not one — the field is free text, so most of what it holds is not a
 * code at all and gets no decoration.
 */
export const countryName = (code: string, locale: string = getLocale()): string | undefined => {
  const alpha2 = ALPHA2[code.trim().toUpperCase()]
  if (!alpha2) return undefined
  const name = displayNames(locale)?.of(alpha2)
  // ICU hands the code back when it has no name for it.
  return name && name !== alpha2 ? name : undefined
}
