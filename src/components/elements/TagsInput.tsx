import { useState, type KeyboardEvent } from 'react'

interface Props {
  value: string[]
  onChange: (tags: string[]) => void
}

// Minimal tags input: type + Enter to add, click a tag to remove it.
export default function TagsInput({ value, onChange }: Props) {
  const [input, setInput] = useState('')

  const addTag = () => {
    const tag = input.trim()
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setInput('')
  }

  const removeTag = (tag: string) => onChange(value.filter(t => t !== tag))

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addTag()
    } else if (event.key === 'Backspace' && input === '' && value.length) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-sm border border-line2 bg-field px-2 py-1.5 transition-colors focus-within:border-accent-line">
      {value.map(tag => (
        <span
          key={tag}
          onClick={() => removeTag(tag)}
          className="flex cursor-pointer items-center gap-1 rounded-sm bg-accent-soft px-2 py-1 font-mono text-xs text-accent hover:brightness-95"
        >
          {tag}
          <span className="opacity-60">×</span>
        </span>
      ))}
      <input
        // The one input in the entry form with no `name` — specs address it here.
        data-testid="tags-input"
        className="min-w-[80px] flex-1 !border-0 !bg-transparent !p-1 !text-base !text-text !outline-none"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
      />
    </div>
  )
}
