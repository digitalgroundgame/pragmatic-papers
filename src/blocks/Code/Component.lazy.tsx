"use client"
import dynamic from "next/dynamic"

// The highlighter (prism-react-renderer) loads only on pages that show code.
export const Code = dynamic(() => import("./Component.client").then((m) => m.Code))
