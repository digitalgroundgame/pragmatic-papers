[← Table of Contents](https://github.com/digitalgroundgame/pragmatic-papers/wiki#table-of-contents)

## Overview

When a PR includes new or updated E2E tests that call `page.screenshot()`, the CI pipeline automatically captures those screenshots against a seeded database and prepends them to the PR description. No configuration required — the screenshot call in the test is the opt-in signal.

## How It Works

1. On every PR open or push, the **PR Screenshots** workflow (`pr-screenshots.yml`) diffs the changed files under `tests/e2e/`
2. If any changed file contains a `page.screenshot()` call, the workflow:
   - Seeds the test database with a minimal article and volume
   - Runs the E2E tests (Chromium only) with `SEED_E2E=true`
   - Uploads each PNG in `screenshots/` to GitHub's CDN
   - Prepends a **Screenshots** section to the PR description
3. If no `page.screenshot()` calls are found in the changed E2E files, the workflow exits immediately — no browsers installed, nothing uploaded

> [!NOTE]
> Screenshots are hosted on GitHub's CDN (`user-images.githubusercontent.com`) and are never committed to the repository. The local `screenshots/` directory is gitignored.

## Adding Screenshots to Your Feature

In your E2E test, call `page.screenshot()` at the most visually meaningful moment — after the UI state you want documented is fully visible:

```ts
test("popover opens on click and shows URL input", async ({ page }) => {
  // ... navigate and interact ...
  await page.getByRole("button", { name: "Share" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()

  // Screenshot taken here — popover is open and fully rendered
  await page.screenshot({ path: "screenshots/share-popover-article.png" })
})
```

Use a descriptive filename — it becomes the caption in the PR description. A few well-chosen screenshots are better than one per test.

> [!TIP]
> Place the `page.screenshot()` call **after** your assertions, so you only capture the page when the feature is confirmed to be in the expected state.

## Seeded Test Data

The workflow seeds one article and one volume before running tests so that page-level screenshots have real content. If your feature requires different data, extend `scripts/seed-e2e.ts` using Payload's local API.

## Further Reading

- [Creating Pull Requests](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Creating-Pull-Requests)
- [Pull Request Checklist](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Pull-Request-Checklist)
