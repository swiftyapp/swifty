import { t } from '@/i18n'
import type { Section } from '../Navigation'
import ThirdParty from './ThirdParty'
import Swftx from './Swftx'
import Export from './Export'

interface Props {
  section: Section
}

export default function Import({ section }: Props) {
  if (section !== 'import') return null

  return (
    <>
      <h1>{t('Import & Export')}</h1>
      <ThirdParty />
      <Swftx />
      <Export />
    </>
  )
}
