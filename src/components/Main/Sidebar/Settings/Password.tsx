import { useState, useEffect, type ChangeEvent } from 'react'
import { generatePassword, type GeneratorOptions } from '@/lib/commands'
import { getProps, setProps } from '@/defaults/generator'
import { t } from '@/i18n'
import type { Section } from './Navigation'

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
      <h1>{t('Password Settings')}</h1>
      <div className="section">
        <strong>{t('Example')}</strong>
        <div className="password-sample">{example}</div>
      </div>
      <div className="section">
        <strong>{t('Length')}</strong>
        <div>
          <input
            type="range"
            name="length"
            min="6"
            max="50"
            className="slider"
            value={options.length}
            onChange={onLength}
          />
          <div className="pass-count">{options.length}</div>
        </div>
      </div>
      <div className="section">
        <strong>{t('Symbols')}</strong>
        <div>
          <label>
            <input
              type="checkbox"
              name="numbers"
              checked={options.numbers}
              onChange={onToggle}
            />
            {t('Numbers')}
          </label>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              name="uppercase"
              checked={options.uppercase}
              onChange={onToggle}
            />
            {t('Uppercase')}
          </label>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              name="symbols"
              checked={options.symbols}
              onChange={onToggle}
            />
            {t('Special characters')}
          </label>
        </div>
      </div>
    </>
  )
}
