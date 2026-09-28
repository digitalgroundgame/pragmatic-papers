import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "../avatar"

describe("Avatar", () => {
  it("renders default size with fallback", () => {
    const { container } = render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders sm size", () => {
    const { container } = render(
      <Avatar size="sm">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders lg size", () => {
    const { container } = render(
      <Avatar size="lg">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})

describe("AvatarImage", () => {
  it("renders with src", () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="/test.jpg" />
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})

describe("AvatarBadge", () => {
  it("renders inside avatar", () => {
    const { container } = render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
        <AvatarBadge />
      </Avatar>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})

describe("AvatarGroup", () => {
  it("renders stacked avatars with overflow count", () => {
    const { container } = render(
      <AvatarGroup>
        <Avatar size="sm">
          <AvatarFallback>AB</AvatarFallback>
        </Avatar>
        <Avatar size="sm">
          <AvatarFallback>CD</AvatarFallback>
        </Avatar>
        <AvatarGroupCount>+3</AvatarGroupCount>
      </AvatarGroup>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
