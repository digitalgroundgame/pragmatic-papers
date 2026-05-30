"use client"
import { useTheme } from "@wrksz/themes/client"
import { Highlight, themes } from "prism-react-renderer"
import React from "react"
import { CopyButton } from "./CopyButton"

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type Props = {
  code: string
  language?: string
}

export const Code: React.FC<Props> = ({ code, language = "" }) => {
  const { resolvedTheme } = useTheme()

  if (!code) return null

  return (
    <Highlight
      code={code}
      language={language}
      theme={resolvedTheme === "dark" ? themes.vsDark : themes.vsLight}
    >
      {({ getLineProps, getTokenProps, tokens }) => (
        <pre className="bg-background overflow-x-auto rounded-sm border p-3 text-sm">
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ className: "table-row", line })}>
              <span className="text-muted-foreground table-cell text-right select-none">
                {i + 1}
              </span>
              <span className="table-cell pl-3">
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </span>
            </div>
          ))}
          <CopyButton code={code} />
        </pre>
      )}
    </Highlight>
  )
}
