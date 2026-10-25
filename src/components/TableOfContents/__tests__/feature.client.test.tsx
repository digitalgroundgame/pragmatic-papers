import type { LexicalEditor } from "@payloadcms/richtext-lexical/lexical"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { getRegisteredEditor } from "../editorRegistry"
import { RegisterEditorPlugin } from "../feature.client"

const editor = {} as LexicalEditor

vi.mock("@payloadcms/richtext-lexical/client", () => ({
  createClientFeature: (feature: unknown) => feature,
  useEditorConfigContext: () => ({ editor, fieldProps: { path: "content" } }),
}))

describe("RegisterEditorPlugin", () => {
  afterEach(cleanup)

  it("registers its editor under the field's path while it's mounted", () => {
    const { unmount } = render(<RegisterEditorPlugin />)
    expect(getRegisteredEditor("content")).toBe(editor)

    unmount()
    expect(getRegisteredEditor("content")).toBeUndefined()
  })
})
