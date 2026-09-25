// Two workspaces are told apart on screen by name alone, so one that differs
// from another only in case or surrounding space is the same name.
export const nameTaken = (name: string, taken: readonly string[]): boolean => {
  const key = name.trim().toLowerCase()
  return !!key && taken.some(other => other.trim().toLowerCase() === key)
}
