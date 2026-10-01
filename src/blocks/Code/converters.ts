import type { CodeBlock } from "@/payload-types"
import { escapeHTML } from "@/utilities/feedHTML"

/**
 * Code as an escaped `<pre><code>`, or nothing when the block is empty. The
 * `<pre>` is focusable: a long line scrolls sideways, and keyboard users need
 * to reach it to scroll it.
 */
export const codeToHTML = ({ code }: Pick<CodeBlock, "code">): string =>
  code ? `<pre tabindex="0"><code>${escapeHTML(code)}</code></pre>` : ""
