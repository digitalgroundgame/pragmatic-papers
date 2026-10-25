"use client"

import { createClientFeature, useEditorConfigContext } from "@payloadcms/richtext-lexical/client"
import { useEffect } from "react"

import { registerEditor } from "./editorRegistry"

export const RegisterEditorPlugin: React.FC = () => {
  const { editor, fieldProps } = useEditorConfigContext()
  const { path } = fieldProps

  useEffect(() => registerEditor(path, editor), [editor, path])

  return null
}

export const TableOfContentsLabelsFeatureClient = createClientFeature(() => ({
  plugins: [{ Component: RegisterEditorPlugin, position: "normal" }],
}))
