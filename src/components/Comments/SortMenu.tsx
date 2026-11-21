"use client"

import React from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { COMMENT_SORTS, type CommentSort } from "./tree"

export interface SortMenuProps {
  value: CommentSort
  onChange: (sort: CommentSort) => void
}

/** "Sort by" for top-level comments. */
export const SortMenu: React.FC<SortMenuProps> = ({ value, onChange }) => (
  <Select value={value} onValueChange={(next) => onChange(next as CommentSort)}>
    <SelectTrigger size="sm" aria-label="Sort comments">
      {/* The label, not the bare value: the popup's items mount only once it opens. */}
      <SelectValue>
        <span className="text-muted-foreground">Sort:</span>{" "}
        {COMMENT_SORTS.find((sort) => sort.value === value)?.label}
      </SelectValue>
    </SelectTrigger>
    <SelectContent aria-label="Sort comments">
      {COMMENT_SORTS.map((sort) => (
        <SelectItem key={sort.value} value={sort.value} label={sort.label}>
          {sort.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)
