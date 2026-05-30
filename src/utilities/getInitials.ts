export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return parts[0]!.charAt(0).toUpperCase() + parts[1]!.charAt(0).toUpperCase()
}
