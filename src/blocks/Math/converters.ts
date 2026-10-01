import type { DisplayMathBlock, InlineMathBlock } from "@/payload-types"
import { escapeHTML } from "@/utilities/feedHTML"

type MathFields = Pick<DisplayMathBlock | InlineMathBlock, "math">

/**
 * Display math in MathJax's `\[…\]` delimiters, for readers that typeset it;
 * the rest show the LaTeX.
 */
export const displayMathToHTML = ({ math }: MathFields): string =>
  math ? `<p class="math display-math">\\[${escapeHTML(math)}\\]</p>` : ""

/** Inline math in MathJax's `\(…\)` delimiters. */
export const inlineMathToHTML = ({ math }: MathFields): string =>
  math ? `<span class="math">\\(${escapeHTML(math)}\\)</span>` : ""

/** Display math as its LaTeX source in a code block, for editors that can't typeset (Substack). */
export const displayMathToCode = ({ math }: MathFields): string =>
  math ? `<pre><code>${escapeHTML(math)}</code></pre>` : ""

/** Inline math as its LaTeX source in inline code. */
export const inlineMathToCode = ({ math }: MathFields): string =>
  math ? `<code>${escapeHTML(math)}</code>` : ""
