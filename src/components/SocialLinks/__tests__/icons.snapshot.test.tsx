import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { GithubIcon, InstagramIcon, SubstackIcon, TiktokIcon, YoutubeIcon } from "../icons"

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
})
