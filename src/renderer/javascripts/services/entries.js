export const filterEntries = (entries, options) => {
  return entries
    .filter(entry => {
      return (
        matchScope(entry, options.scope) &&
        matchQuery(entry, options.query) &&
        matchTags(entry, options.tags)
      )
    })
    .sort((a, b) => {
      if (a.title < b.title) return -1
      if (a.title > b.title) return 1
      return 0
    })
}

const matchScope = (entry, scope) => {
  return entry.type === scope
}

const matchQuery = (entry, query) => {
  if (query === '') return true
  return entry.title.toLowerCase().match(query.toLowerCase())
}

const matchTags = (entry, tags) => {
  if (!tags || tags.length === 0) return true
  return entry.tags && entry.tags.some(tag => tags.includes(tag))
}
