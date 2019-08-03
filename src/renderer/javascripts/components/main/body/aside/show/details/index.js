import React from 'react'
import Login from './login'
import Card from './card'
import Note from './note'

const Details = ({ entry }) => {
  switch (entry.type) {
    case 'login':
      return <Login entry={entry} />
    case 'card':
      return <Card entry={entry} />
    case 'note':
      return <Note entry={entry} />
    default:
      return null
  }
}

export default Details
