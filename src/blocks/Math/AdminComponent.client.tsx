"use client"
import { MathJax } from "better-react-mathjax"
import React from "react"

interface AdminMathBlockLabelProps {
  math: string
}

export const AdminMathBlockLabel: React.FC<AdminMathBlockLabelProps> = ({ math }) => {
  return <MathJax inline>\({math}\)</MathJax>
}
