import { formatTimeAgo } from "@/utilities/formatDateTime"

export function TimeAgo({ publishedAt }: { publishedAt?: string | null }): React.ReactNode {
  if (!publishedAt) return null
  return (
    <p className="text-muted-foreground mt-1 font-sans text-xs">{formatTimeAgo(publishedAt)}</p>
  )
}
