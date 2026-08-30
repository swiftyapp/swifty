import type { Entry } from '@/lib/commands'
import Login from './Login'
import Card from './Card'
import Note from './Note'

interface Props {
  entry: Entry
}

export default function Details({ entry }: Props) {
  switch (entry.type) {
    case 'login':
      return <Login entry={entry} />
    case 'card':
      return <Card entry={entry} />
    case 'note':
      return <Note entry={entry} />
  }
}
