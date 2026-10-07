"use client"
import dynamic from "next/dynamic"

// react-hook-form and the field controls load only on pages with a form.
export const FormBlockClient = dynamic(() =>
  import("./FormBlockClient").then((m) => m.FormBlockClient),
)
