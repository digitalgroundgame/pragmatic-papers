"use client"

import {
  $createInlineBlockNode,
  $isInlineBlockNode,
  createClientFeature,
} from "@payloadcms/richtext-lexical/client"
import {
  $getRoot,
  $isElementNode,
  $isTextNode,
  type LexicalNode,
  TextNode,
} from "@payloadcms/richtext-lexical/lexical"
import { useLexicalComposerContext } from "@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext"
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  type TriggerFn,
} from "@payloadcms/richtext-lexical/lexical/react/LexicalTypeaheadMenuPlugin"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"

import type { FootnoteBlock } from "@/payload-types"

import { truncate } from "./utils"

type CreateInlineBlockFields = Parameters<typeof $createInlineBlockNode>[0]
const createFootnoteNode = (fields: Partial<FootnoteBlock> & { blockType: "footnote" }) =>
  $createInlineBlockNode(fields as unknown as CreateInlineBlockFields)

const SHORTCUT_REGEX = /\[\^([^\]]+)\]/
const TRIGGER_REGEX = /(^|\s|\()(\[\^([^\]]*))$/
const PREVIEW_LIMIT = 60
const MAX_SUGGESTIONS = 8

type FootnoteSource = Pick<FootnoteBlock, "note" | "attributionEnabled" | "link"> & {
  id: string
}

const collectFootnoteSources = (): FootnoteSource[] => {
  const out: FootnoteSource[] = []
  const seen = new Set<string>()
  const stack: LexicalNode[] = [$getRoot()]
  while (stack.length) {
    const node = stack.pop()!
    if ($isInlineBlockNode(node)) {
      const fields = node.getFields() as Partial<FootnoteBlock>
      if (
        fields.blockType === "footnote" &&
        !fields.sourceId &&
        fields.id &&
        fields.note &&
        !seen.has(fields.id)
      ) {
        seen.add(fields.id)
        out.push({
          id: fields.id,
          note: fields.note,
          attributionEnabled: fields.attributionEnabled,
          link: fields.link,
        })
      }
    }
    if ($isElementNode(node)) {
      const children = node.getChildren()
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]!)
    }
  }
  return out
}

const triggerFn: TriggerFn = (text) => {
  const match = TRIGGER_REGEX.exec(text)
  if (!match) return null
  return {
    leadOffset: match.index + (match[1]?.length ?? 0),
    matchingString: match[3] ?? "",
    replaceableString: match[2] ?? "",
  }
}

class FootnoteMenuOption extends MenuOption {
  source: FootnoteSource
  constructor(source: FootnoteSource) {
    super(source.id)
    this.source = source
  }
}

const FootnoteShortcutPlugin: React.FC = () => {
  const [editor] = useLexicalComposerContext()
  const [queryString, setQueryString] = useState<string | null>(null)
  const [sources, setSources] = useState<FootnoteSource[]>([])

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        setSources(collectFootnoteSources())
      })
    })
  }, [editor])

  const options = useMemo(() => {
    if (queryString === null) return []
    const q = queryString.toLowerCase().trim()
    return sources
      .filter((s) => (q ? s.note.toLowerCase().includes(q) : true))
      .slice(0, MAX_SUGGESTIONS)
      .map((s) => new FootnoteMenuOption(s))
  }, [queryString, sources])

  useEffect(() => {
    return editor.registerNodeTransform(TextNode, (textNode) => {
      if (!$isTextNode(textNode) || !textNode.isSimpleText()) return
      const text = textNode.getTextContent()
      const match = SHORTCUT_REGEX.exec(text)
      if (!match) return
      const noteText = match[1]?.trim()
      if (!noteText) return
      const matchStart = match.index
      const matchEnd = matchStart + match[0].length
      const splits = textNode.splitText(matchStart, matchEnd)
      const matchNode = splits[matchStart > 0 ? 1 : 0]
      if (!matchNode) return

      const existing = collectFootnoteSources().find((s) => s.note === noteText) ?? null
      const footnote = createFootnoteNode(
        existing
          ? {
              blockName: "",
              blockType: "footnote",
              sourceId: existing.id,
              note: existing.note,
              attributionEnabled: existing.attributionEnabled,
              link: existing.link,
            }
          : { blockName: "", blockType: "footnote", note: noteText },
      )
      matchNode.replace(footnote)
    })
  }, [editor])

  const onSelectOption = useCallback(
    (
      option: FootnoteMenuOption,
      textNodeContainingQuery: TextNode | null,
      closeMenu: () => void,
      matchingString: string,
    ) => {
      editor.update(() => {
        const node = textNodeContainingQuery
        if (!node) {
          closeMenu()
          return
        }
        const triggerLength = 2 + matchingString.length // [^ + typed
        const text = node.getTextContent()
        const splitOffset = text.length - triggerLength
        let triggerNode = node
        if (splitOffset > 0) {
          const parts = node.splitText(splitOffset)
          triggerNode = parts[parts.length - 1]!
        }
        const footnote = createFootnoteNode({
          blockName: "",
          blockType: "footnote",
          sourceId: option.source.id,
          note: option.source.note,
          attributionEnabled: option.source.attributionEnabled,
          link: option.source.link,
        })
        triggerNode.replace(footnote)
        closeMenu()
      })
    },
    [editor],
  )

  return (
    <LexicalTypeaheadMenuPlugin<FootnoteMenuOption>
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      options={options}
      triggerFn={triggerFn}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
      ) => {
        if (!anchorElementRef.current || options.length === 0) return null
        return createPortal(
          <div
            style={{
              background: "var(--theme-elevation-50, #fff)",
              border: "1px solid var(--theme-elevation-150, #ddd)",
              borderRadius: 4,
              boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
              maxWidth: 360,
              minWidth: 240,
              padding: 4,
              zIndex: 10,
            }}
          >
            {options.map((option, i) => (
              <button
                key={option.key}
                onClick={() => selectOptionAndCleanUp(option)}
                onMouseEnter={() => setHighlightedIndex(i)}
                ref={(el) => option.setRefElement(el)}
                style={{
                  background:
                    i === selectedIndex ? "var(--theme-elevation-100, #eef)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "block",
                  fontSize: 13,
                  padding: "6px 8px",
                  textAlign: "left",
                  width: "100%",
                }}
                type="button"
              >
                {truncate(option.source.note, PREVIEW_LIMIT)}
              </button>
            ))}
          </div>,
          anchorElementRef.current,
        )
      }}
    />
  )
}

export const FootnoteShortcutFeatureClient = createClientFeature(() => ({
  plugins: [
    {
      Component: FootnoteShortcutPlugin,
      position: "normal",
    },
  ],
}))
