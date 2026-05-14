import React from "react"

import type { PopulatedAuthors } from "@/payload-types"

import { AuthorCard } from "@/components/Authors/AuthorCard"
import { cn } from "@/utilities/utils"

export interface AuthorListProps extends React.HTMLAttributes<HTMLDivElement> {
  classNames?: string
  authors?: PopulatedAuthors
}

export const AuthorList: React.FC<AuthorListProps> = ({ authors, classNames, ...props }) => {
  if (!authors || !authors.length) return null

  return (
    <section aria-label="Authors" className={cn("space-y-3", classNames)} {...props}>
      <h2>Meet the Author{authors.length > 1 ? "s" : ""}</h2>
      <div className="flex flex-col gap-4">
        {authors.map((author) => (
          <AuthorCard key={author.id} author={author} />
        ))}
      </div>
    </section>
  )
}
