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
    <div className="react-tagsinput">
      <span>
        {value.map(tag => (
          <span key={tag} className="react-tagsinput-tag" onClick={() => removeTag(tag)}>
            {tag}
          </span>
        ))}
        <input
          className="react-tagsinput-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
        />
      </span>
    </div>
  )
}
