import { type Topic } from "@/payload-types"
import React from "react"

import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { Badge } from "@/components/ui/badge"
import { isResolved } from "@/utilities/relationships"

export interface TopicsListProps extends React.HTMLAttributes<HTMLElement> {
  topics: (number | Topic)[] | null | undefined
  badgeClassName?: string
  /** A small label at the start of the row, e.g. "Topics:". */
  label?: string
}

export const TopicsList: React.FC<TopicsListProps> = ({
  topics,
  badgeClassName,
  label,
  className,
  ...props
}) => {
  if (!topics?.length) return null

  const resolvedTopics = topics.filter(isResolved<Topic>)

  if (!resolvedTopics.length) return null

  return (
    <section aria-label="Topics" className={className} {...props}>
      <div className="flex flex-wrap items-center gap-2">
        {label && (
          <span aria-hidden="true" className="text-muted-foreground text-sm font-medium">
            {label}
          </span>
        )}
        {resolvedTopics.map((topic) => (
          <Badge
            key={topic.id}
            variant="brand"
            className={badgeClassName}
            render={
              <HoverPrefetchLink href={`/topics/${topic.slug}`} className="hover:underline">
                {topic.name}
              </HoverPrefetchLink>
            }
          />
        ))}
      </div>
    </section>
  )
}
