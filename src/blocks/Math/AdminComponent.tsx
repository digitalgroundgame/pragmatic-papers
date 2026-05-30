import React from "react"
import { AdminMathBlockLabel } from "./AdminComponent.client"

interface AdminMathBlockProps {
  siblingData: {
    blockType: string
    id: string
    math: string
  }
}

const AdminMathBlock: React.FC<AdminMathBlockProps> = ({ siblingData: { math } }) => {
  return <AdminMathBlockLabel math={math} />
}

export default AdminMathBlock
