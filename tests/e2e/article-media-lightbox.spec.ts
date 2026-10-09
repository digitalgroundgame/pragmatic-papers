import { expect, test } from "@playwright/test"

import { LIGHTBOX_IMAGE_ALT, LIGHTBOX_SLUG } from "../../scripts/seed-e2e.constants"

// The e2e seed gives LIGHTBOX_SLUG a single media block. In an article's rich
// text a media block renders as LightboxMediaBlock: the image is the trigger of
// a dialog that shows it full screen. Its unit test opens the dialog in jsdom;
// dismissing it and where focus lands need a real browser.

test("the media lightbox opens on click and closes by Escape or its button", async ({ page }) => {
  await page.goto(`/articles/${LIGHTBOX_SLUG}`)
  const trigger = page.getByRole("button", { name: LIGHTBOX_IMAGE_ALT })
  const lightbox = page.getByRole("dialog")
  await expect(lightbox).toBeHidden()

  await trigger.click()

  await expect(lightbox).toBeVisible()
  await expect(lightbox.getByRole("img", { name: LIGHTBOX_IMAGE_ALT })).toBeVisible()

  await page.keyboard.press("Escape")

  await expect(lightbox).toBeHidden()
  // Focus goes back to the image, so a keyboard reader keeps their place.
  await expect(trigger).toBeFocused()

  await trigger.click()
  await expect(lightbox).toBeVisible()

  await lightbox.getByRole("button", { name: "Close" }).click()

  await expect(lightbox).toBeHidden()
})
