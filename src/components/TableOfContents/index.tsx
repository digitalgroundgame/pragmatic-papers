import type { LucideIcon } from "lucide-react"

import { blocksWith } from "@/blocks/registry"
import { createTableOfContents } from "./create"
import type { TableOfContentsResolverMap } from "./types"

function entryIcon(Icon: LucideIcon): React.ReactNode {
  return <Icon aria-hidden="true" className="text-muted-foreground size-3 shrink-0" />
}

// A block gets an entry from the `tableOfContents` its descriptor declares
// (`src/blocks/<Name>/index.ts`).
const blockResolvers: TableOfContentsResolverMap = Object.fromEntries(
  Object.entries(blocksWith("tableOfContents")).map(([slug, resolve]) => [
    slug,
    (fields: unknown) => {
      const entry = resolve(fields as never)
      return entry && { label: entry.label, icon: entryIcon(entry.icon) }
    },
  ]),
)

export const {
  TableOfContentsProvider,
  TableOfContents,
  TableOfContentsButton,
  tableOfContentsField,
  tableOfContentsConverter,
  withTableOfContentsAnchors,
  tableOfContentsEntries,
  stampTableOfContentsAnchors,
  populateTableOfContentsAnchors,
} = createTableOfContents({
  // The footnote list and its references render footnote-N / footnote-ref-N.
  reservedAnchors: [/^footnote-(ref-)?\d+$/],
  resolvers: blockResolvers,
})
