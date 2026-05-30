import { type Topic } from "@/payload-types"
import React from "react"

import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { Badge } from "@/components/ui/badge"

export interface TopicsListProps extends React.HTMLAttributes<HTMLElement> {
  topics: (number | Topic)[] | null | undefined
  badgeClassName?: string
}

export const TopicsList: React.FC<TopicsListProps> = ({
  topics,
  badgeClassName,
  className,
  ...props
}) => {
  if (!topics?.length) return null

  const resolvedTopics = topics.filter((topic): topic is Topic => typeof topic === "object")

  if (!resolvedTopics.length) return null

  return (
    <section aria-label="Topics" className={className} {...props}>
      <div className="flex flex-wrap gap-2">
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
