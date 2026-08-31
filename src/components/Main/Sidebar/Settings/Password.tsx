import { useState, useEffect, type ChangeEvent } from 'react'
import { generatePassword, type GeneratorOptions } from '@/lib/commands'
import { getProps, setProps } from '@/defaults/generator'
import { t } from '@/i18n'
import type { Section } from './Navigation'
import { H1, Section as Row, LABEL, Checkbox } from './ui'

interface Props {
  section: Section
}

export default function Password({ section }: Props) {
  const [options, setOptions] = useState<GeneratorOptions>(getProps())
  const [example, setExample] = useState('')

  useEffect(() => {
    generatePassword(options).then(setExample).catch(() => {})
  }, [options])

  const update = (option: Partial<GeneratorOptions>) => {
    const updated = { ...options, ...option }
    setProps(updated)
    setOptions(updated)
  }

  const onToggle = (e: ChangeEvent<HTMLInputElement>) =>
    update({ [e.target.name]: e.target.checked })

  const onLength = (e: ChangeEvent<HTMLInputElement>) =>
    update({ length: Number(e.target.value) })

  if (section !== 'password') return null

  return (
    <>
      <h1 className={H1}>{t('Password Settings')}</h1>
      <Row>
        <strong className={LABEL}>{t('Example')}</strong>
        <div className="rounded-sm border border-line bg-field px-3 py-2.5 font-mono text-lg text-text">
          {example}
        </div>
      </Row>
      <Row>
        <strong className={LABEL}>{t('Length')}</strong>
        <div className="flex items-center gap-4">
          <input
            type="range"
            name="length"
            min="6"
            max="50"
            className="h-1.5 flex-1 accent-accent"
            value={options.length}
            onChange={onLength}
          />
          <div className="grid h-6 min-w-[32px] place-items-center rounded-sm bg-accent-soft px-1.5 font-mono text-xs text-accent">
            {options.length}
          </div>
        </div>
      </Row>
      <Row>
        <strong className={LABEL}>{t('Symbols')}</strong>
        <Checkbox name="numbers" checked={options.numbers} onChange={onToggle}>
          {t('Numbers')}
        </Checkbox>
        <Checkbox name="uppercase" checked={options.uppercase} onChange={onToggle}>
          {t('Uppercase')}
        </Checkbox>
        <Checkbox name="symbols" checked={options.symbols} onChange={onToggle}>
          {t('Special characters')}
        </Checkbox>
      </Row>
    </>
  )
}
