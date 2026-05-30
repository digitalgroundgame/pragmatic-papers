export function getSeparator(index: number, _length: number): string | undefined {
  if (index === 0) return undefined
  // if (index === length - 1) return length === 2 ? " and " : ", and "
  return "•"
}

export function formatList(items: string[]): string {
  if (items.length === 0) return ""
  if (items.length === 1) return items[0] ?? ""
  const last = items[items.length - 1]
  return `${items.slice(0, -1).join(", ")}, and ${last}`
}

export function formatListWithLimit(items: string[], limit: number): string {
  if (items.length === 0) return ""
  if (limit <= 0) return ""
  if (items.length <= limit) return formatList(items)
  const shown = items.slice(0, limit)
  const remaining = items.length - limit
  if (remaining === 1) return `${formatList(shown)}, and 1 other`
  return `${formatList(shown)}, and ${remaining} others`
}
