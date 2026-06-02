import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import {
  FacebookIcon,
  GithubIcon,
  InstagramIcon,
  SubstackIcon,
  ThreadsIcon,
  TiktokIcon,
  YoutubeIcon,
} from "../icons"

afterEach(cleanup)

describe("SocialLinks icons", () => {
  it("renders InstagramIcon", () => {
    const { container } = render(<InstagramIcon />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders SubstackIcon", () => {
    const { container } = render(<SubstackIcon />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders YoutubeIcon", () => {
    const { container } = render(<YoutubeIcon />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders TiktokIcon", () => {
    const { container } = render(<TiktokIcon />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders GithubIcon", () => {
    const { container } = render(<GithubIcon />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders FacebookIcon", () => {
    const { container } = render(<FacebookIcon />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders ThreadsIcon", () => {
    const { container } = render(<ThreadsIcon />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
