import type { UnsplashPhoto } from "@/integrations/unsplash"
import type { Media } from "@/payload-types"

/**
 * The caption credit for a photo from Unsplash. Shared by the picker, which shows it as soon
 * as a photo is picked, and `attributeUnsplashPhoto`, which writes it again on save from the
 * photo it looks up itself. Neither imports anything server-only.
 */

type Caption = NonNullable<Media["caption"]>
type Node = Caption["root"]["children"][number]

const text = (value: string): Node => ({
  detail: 0,
  format: 0,
  mode: "normal",
  style: "",
  text: value,
  type: "text",
  version: 1,
})

const link = (label: string, url: string): Node => ({
  children: [text(label)],
  direction: "ltr",
  fields: { linkType: "custom", newTab: true, url },
  format: "",
  indent: 0,
  type: "link",
  version: 1,
})

/** "Photo by <name> on Unsplash.", both linked, the credit Unsplash's guidelines ask for. */
export function unsplashCredit(photo: Pick<UnsplashPhoto, "photographer">, homeUrl: string): Node {
  return {
    children: [
      text("Photo by "),
      link(photo.photographer.name, photo.photographer.profileUrl),
      text(" on "),
      link("Unsplash", homeUrl),
      text("."),
    ],
    direction: "ltr",
    format: "",
    indent: 0,
    type: "paragraph",
    version: 1,
    textFormat: 0,
    textStyle: "",
  }
}

/** A paragraph linking to Unsplash's home page: a credit this site wrote. */
function isCredit(node: Node): boolean {
  const children = (node as { children?: Node[] }).children ?? []
  return children.some((child) => {
    const url = (child as { fields?: { url?: unknown } }).fields?.url
    if (child.type !== "link" || typeof url !== "string") return false
    try {
      const parsed = new URL(url)
      return parsed.hostname === "unsplash.com" && parsed.pathname === "/"
    } catch {
      return false
    }
  })
}

/** Whether the caption already credits a photo from Unsplash. */
export function hasCredit(caption: Media["caption"]): boolean {
  return (caption?.root?.children ?? []).some(isCredit)
}

/** An empty paragraph, what the editor holds when the caption is blank. */
function emptyParagraph(): Node {
  return {
    children: [],
    direction: null,
    format: "",
    indent: 0,
    type: "paragraph",
    version: 1,
    textFormat: 0,
    textStyle: "",
  } as unknown as Node
}

/**
 * The caption with any earlier Unsplash credit replaced by `credit`, as its last paragraph
 * (the whole caption when there was nothing else), or removed when `credit` is null. Writing
 * the same credit twice leaves one.
 */
export function withCredit(caption: Media["caption"], credit: Node | null): Caption {
  const kept = (caption?.root?.children ?? []).filter((node) => !isCredit(node))
  const hasText = JSON.stringify(kept).includes('"text":"')
  const children = hasText ? kept : []
  if (credit) children.push(credit)
  return {
    root: {
      type: "root",
      direction: "ltr",
      format: "",
      indent: 0,
      version: 1,
      ...caption?.root,
      children: children.length ? children : [emptyParagraph()],
    },
  }
}
