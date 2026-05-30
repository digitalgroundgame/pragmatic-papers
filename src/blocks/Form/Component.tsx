import { type FormBlock as FormBlockType } from "@/payload-types"
import React from "react"

import { FormBlockClient } from "./FormBlockClient"

export const FormBlock: React.FC<FormBlockType> = ({ form, ...block }) => {
  if (typeof form === "number") return null
  return <FormBlockClient form={form} {...block} />
}
