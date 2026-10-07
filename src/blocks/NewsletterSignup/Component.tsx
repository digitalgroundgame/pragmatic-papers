import { RichText as ConvertRichText, LinkJSXConverter } from "@payloadcms/richtext-lexical/react"
import React from "react"

import { NewsletterSignupForm, type NewsletterSignupBlockProps } from "./Component.client"

export type { NewsletterSignupBlockProps }

/** The newsletter form, with its notice's rich text rendered here on the server. */
export const NewsletterSignupBlock: React.FC<NewsletterSignupBlockProps> = ({
  notice,
  ...props
}) => (
  <NewsletterSignupForm
    {...props}
    notice={
      notice ? (
        <ConvertRichText
          className="text-muted-foreground [&_a:hover]:text-foreground text-sm [&_a]:underline [&_a]:underline-offset-4"
          converters={({ defaultConverters }) => ({
            ...defaultConverters,
            ...LinkJSXConverter({
              internalDocToHref: ({ linkNode }) => linkNode.fields.url ?? "#",
            }),
          })}
          data={notice}
        />
      ) : null
    }
  />
)
