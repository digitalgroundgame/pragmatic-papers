import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  createEditor,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type TextNode,
} from "@payloadcms/richtext-lexical/lexical"
import { $createLinkNode, LinkNode } from "@payloadcms/richtext-lexical/lexical/link"
import { INSERT_INLINE_BLOCK_COMMAND } from "@payloadcms/richtext-lexical/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  $trimSpaceBefore,
  $trimSpaceBeforeSelection,
  registerFootnoteSpaceTrim,
} from "@/blocks/Footnote/trimSpace"

vi.mock("@payloadcms/richtext-lexical/client", async () => {
  const { createCommand } = await import("@payloadcms/richtext-lexical/lexical")
  return { INSERT_INLINE_BLOCK_COMMAND: createCommand("INSERT_INLINE_BLOCK_COMMAND") }
})

let editor: LexicalEditor

beforeEach(() => {
  editor = createEditor({
    nodes: [LinkNode],
    onError: (error) => {
      throw error
    },
  })
})

/** A stand-in for a footnote: a token, which isn't simple text, so nothing trims inside it. */
const $marker = () => $createTextNode("[1]").setMode("token")

/** Fills one paragraph with `children`, in a discrete update, and returns its text. */
const build = (children: () => LexicalNode[], then?: (nodes: LexicalNode[]) => void) => {
  editor.update(
    () => {
      const nodes = children()
      $getRoot()
        .clear()
        .append($createParagraphNode().append(...nodes))
      then?.(nodes)
    },
    { discrete: true },
  )
  return editor.getEditorState().read(() => $getRoot().getTextContent())
}

describe("$trimSpaceBefore", () => {
  const trimmed = (...before: (() => LexicalNode)[]) =>
    build(
      () => [...before.map((make) => make()), $marker()],
      (nodes) => $trimSpaceBefore(nodes.at(-1)!),
    )

  it("removes the space between a word and the footnote", () => {
    expect(trimmed(() => $createTextNode("a word "))).toBe("a word[1]")
  })

  it("removes only one of two spaces", () => {
    expect(trimmed(() => $createTextNode("a word  "))).toBe("a word [1]")
  })

  it("keeps a non-breaking space", () => {
    expect(trimmed(() => $createTextNode("a word "))).toBe("a word [1]")
  })

  it("leaves text without a space alone", () => {
    expect(trimmed(() => $createTextNode("a word"))).toBe("a word[1]")
  })

  it("does nothing for a footnote at the start of a paragraph", () => {
    expect(
      build(
        () => [$marker()],
        ([node]) => $trimSpaceBefore(node!),
      ),
    ).toBe("[1]")
  })

  it("trims formatted text", () => {
    expect(trimmed(() => $createTextNode("bold ").toggleFormat("bold"))).toBe("bold[1]")
  })

  it("trims the end of a link's text", () => {
    expect(
      trimmed(() => $createLinkNode("https://example.com").append($createTextNode("source "))),
    ).toBe("source[1]")
  })

  it("removes a text node that was only the space, between two footnotes", () => {
    let count = 0
    const text = build(
      () => [$createTextNode("a"), $marker(), $createTextNode(" "), $marker()],
      (nodes) => {
        $trimSpaceBefore(nodes.at(-1)!)
        count = $getRoot().getFirstChildOrThrow<ElementNode>().getChildrenSize()
      },
    )
    expect(text).toBe("a[1][1]")
    expect(count).toBe(3)
  })

  it("doesn't reach into another footnote", () => {
    expect(trimmed($marker)).toBe("[1][1]")
  })
})

describe("$trimSpaceBeforeSelection", () => {
  /** Puts the caret at `offset` in the first text node, trims, and returns the text and caret. */
  const atCaret = (children: () => LexicalNode[], select: (nodes: LexicalNode[]) => void) => {
    let caret: number | undefined
    const text = build(children, (nodes) => {
      select(nodes)
      $trimSpaceBeforeSelection()
      const selection = $getSelection()
      if ($isRangeSelection(selection)) caret = selection.anchor.offset
    })
    return { text, caret }
  }

  it("removes the space before the caret and moves the caret back", () => {
    expect(
      atCaret(
        () => [$createTextNode("a word ")],
        ([node]) => (node as TextNode).select(7, 7),
      ),
    ).toEqual({ text: "a word", caret: 6 })
  })

  it("removes the space before a caret in the middle of the text", () => {
    expect(
      atCaret(
        () => [$createTextNode("a word rest")],
        ([node]) => (node as TextNode).select(7, 7),
      ),
    ).toEqual({ text: "a wordrest", caret: 6 })
  })

  it("leaves a caret after a word alone", () => {
    expect(
      atCaret(
        () => [$createTextNode("a word")],
        ([node]) => (node as TextNode).select(6, 6),
      ),
    ).toEqual({ text: "a word", caret: 6 })
  })

  it("trims the text before a caret at the start of the next node", () => {
    expect(
      atCaret(
        () => [$createTextNode("a word "), $createTextNode("next").toggleFormat("bold")],
        ([, next]) => (next as TextNode).select(0, 0),
      ).text,
    ).toBe("a wordnext")
  })

  it("trims the text before a caret placed between nodes", () => {
    expect(
      atCaret(
        () => [$createLinkNode("https://example.com").append($createTextNode("source "))],
        ([link]) => link!.getParentOrThrow().select(1, 1),
      ).text,
    ).toBe("source")
  })

  it("ignores a range that isn't collapsed", () => {
    expect(
      atCaret(
        () => [$createTextNode("a word ")],
        ([node]) => (node as TextNode).select(2, 7),
      ).text,
    ).toBe("a word ")
  })
})

describe("registerFootnoteSpaceTrim", () => {
  /** Stands in for Payload's own handler, which inserts the block at the caret. */
  const insertAtCaret = () =>
    editor.registerCommand(
      INSERT_INLINE_BLOCK_COMMAND,
      () => {
        $insertNodes([$marker()])
        return true
      },
      COMMAND_PRIORITY_EDITOR,
    )

  const insert = (blockType: string) => {
    registerFootnoteSpaceTrim(editor)
    insertAtCaret()
    build(
      () => [$createTextNode("a word ")],
      ([node]) => (node as TextNode).select(7, 7),
    )
    editor.update(
      () => {
        editor.dispatchCommand(INSERT_INLINE_BLOCK_COMMAND, { blockName: "", blockType })
      },
      { discrete: true },
    )
    return editor.getEditorState().read(() => $getRoot().getTextContent())
  }

  it("trims the space before a footnote from the slash menu or toolbar, then lets Payload insert it", () => {
    expect(insert("footnote")).toBe("a word[1]")
  })

  it("leaves other inline blocks alone", () => {
    expect(insert("inlineMathBlock")).toBe("a word [1]")
  })
})
