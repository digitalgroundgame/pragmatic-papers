import type { MDXComponents } from "mdx/types"

// @next/mdx needs this file to render Markdown in the App Router. The help articles in
// src/docs/ are plain Markdown styled by the page's `prose`, so nothing is overridden.
const components: MDXComponents = {}

export function useMDXComponents(): MDXComponents {
  return components
}
