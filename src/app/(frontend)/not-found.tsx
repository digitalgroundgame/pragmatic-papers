import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { LinkButton } from "@/components/ui/link-button"
import { CircleAlert } from "lucide-react"

export default function NotFound(): React.ReactElement {
  return (
    <Empty className="py-28">
      <EmptyHeader>
        <EmptyMedia>
          <CircleAlert className="text-muted-foreground size-5" />
        </EmptyMedia>
        <EmptyTitle className="grid gap-1">
          <h1 className="text-brand dark:text-brand-high-contrast">404</h1>
          <span className="text-xl">Page Not Found</span>
        </EmptyTitle>
        <EmptyDescription>The page you are looking for does not exist.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-2">
        <LinkButton href="/">Go home</LinkButton>
      </EmptyContent>
    </Empty>
  )
}
