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
