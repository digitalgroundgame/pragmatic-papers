import { describe, expect, it } from "vitest"

import { releaseBranch } from "../../scripts/release"
import { backmergeBranch, hotfixBranch } from "../../scripts/hotfix"

describe("hotfix branch builders", () => {
  it("hotfixBranch carries the fix onto main under hotfix/v*", () => {
    expect(hotfixBranch("1.0.1")).toBe("hotfix/v1.0.1")
  })

  it("backmergeBranch back-merges main → dev under chore/back-merge-v*", () => {
    expect(backmergeBranch("1.0.1")).toBe("chore/back-merge-v1.0.1")
  })
})

describe("release branch builder", () => {
  it("releaseBranch carries the bump into dev under chore/v*", () => {
    expect(releaseBranch("2.2.0")).toBe("chore/v2.2.0")
  })
})
