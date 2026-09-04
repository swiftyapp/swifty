import { useState, type KeyboardEvent } from 'react'
import { TAG_CHIP } from './fields/chip'

interface Props {
  value: string[]
  onChange: (tags: string[]) => void
  /** Translated; an empty box otherwise says nothing about what goes in it. */
  placeholder?: string
}

// Minimal tags input: type + Enter to add, click a tag to remove it. The chips
// are the read view's chips, so committing a tag doesn't restyle it.
export default function TagsInput({ value, onChange, placeholder }: Props) {
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
    <div className="flex flex-wrap items-center gap-2">
      {value.map(tag => (
        <button
          key={tag}
          type="button"
          onClick={() => removeTag(tag)}
          className={`${TAG_CHIP} gap-1 hover:border-bad hover:text-bad`}
        >
          {tag}
          <span className="opacity-60">×</span>
        </button>
      ))}
      <input
        // The one input in the entry editor with no `name` — specs address it here.
        data-testid="tags-input"
        placeholder={placeholder}
        className="h-6 min-w-[110px] flex-1 border-b border-line2 bg-transparent font-mono text-xs text-text outline-none transition-colors placeholder:text-text3 focus:border-accent-line"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
      />
    </div>
  )
}
