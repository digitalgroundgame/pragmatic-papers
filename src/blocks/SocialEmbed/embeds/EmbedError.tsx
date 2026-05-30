import { Card, CardContent } from "@/components/ui/card"
import { ExternalLink, TriangleAlert } from "lucide-react"

interface EmbedErrorProps {
  url: string
  message: string
  displayName: string
}

export function EmbedError({ url, message, displayName }: EmbedErrorProps): React.ReactNode {
  return (
    <Card
      role="alert"
      aria-live="polite"
      className="bg-muted/50 text-muted-foreground/80 mx-auto my-4 max-w-[550px] text-center text-sm"
    >
      <CardContent className="flex flex-col items-center pt-4">
        <TriangleAlert className="h-8 w-8" aria-hidden="true" />
        <p>{message}</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm shadow-none hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
        >
          <span>Click to view on {displayName}</span>
          <ExternalLink className="inline-block h-4 w-4" aria-hidden="true" />
        </a>
      </CardContent>
    </Card>
  )
}
