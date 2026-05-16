import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchIcon } from "lucide-react"
import React from "react"

export function SearchForm(): React.JSX.Element {
  return (
    <form
      action="/search"
      method="get"
      className="bg-muted mx-4 mb-6 flex items-center gap-2 rounded-sm border px-3 py-2"
    >
      <Input
        type="search"
        name="q"
        placeholder="Search…"
        aria-label="Search box"
        className="border-none bg-transparent"
      />
      <Button variant="ghost" size="icon" type="submit">
        <SearchIcon className="size-5" />
        <span className="sr-only">Search</span>
      </Button>
    </form>
  )
}
