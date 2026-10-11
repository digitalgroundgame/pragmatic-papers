import { formatTimeAgo } from "@/utilities/formatDate"

export function TimeAgo({ publishedAt }: { publishedAt?: string | null }): React.ReactNode {
  if (!publishedAt) return null
  return (
    <p data-slot="time-ago" className="text-muted-foreground mt-1 font-sans text-xs">
      {formatTimeAgo(publishedAt)}
    </p>
  )
}
