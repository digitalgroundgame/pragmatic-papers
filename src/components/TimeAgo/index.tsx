import { formatDistanceToNow } from "date-fns"

export function TimeAgo({ publishedAt }: { publishedAt?: string | null }): React.ReactNode {
  if (!publishedAt) return null
  const timeAgo = publishedAt && formatDistanceToNow(new Date(publishedAt), { addSuffix: true })
  return <p className="text-muted-foreground mt-1 font-sans text-xs">{timeAgo}</p>
}
