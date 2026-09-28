"use client"
import React from "react"

import { TypesetMath } from "./TypesetMath"

interface AdminMathBlockLabelProps {
  math: string
}

export const AdminMathBlockLabel: React.FC<AdminMathBlockLabelProps> = ({ math }) => {
  return <TypesetMath inline>\({math}\)</TypesetMath>
}
