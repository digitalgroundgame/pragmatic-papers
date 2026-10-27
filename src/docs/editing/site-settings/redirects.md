---
title: Send old links to their new place with Redirects
navTitle: Redirects
summary: When an article, volume or page changes its address, a redirect keeps old links working.
publishedAt: 2026-10-25
audience: [admin]
---

When a document's address changes (an article's slug is renamed, or a page is replaced by another), links to the old address stop working. A **redirect** sends anyone who follows one to the right place instead.

## Where they are

Open **Redirects** under **Site** in the admin's sidebar. Only admins and chief editors see it, and only they can add, change or delete a redirect.

## Adding one

1. Click **Create new**.
2. In **From URL**, enter the old path, starting with a slash: `/articles/old-slug`, `/volumes/old-slug` or `/old-page`. Leave out the site's address.
3. Under **To URL Type**, pick **Internal link** to choose an article, volume or page, or **Custom URL** to enter any address, on this site or another.
4. Save.

The redirect works straight away, without a redeploy. Linking to a document rather than typing its address means the redirect keeps working if that document's slug changes later.

Each old path can have only one redirect.

## Redirects are permanent

A redirect tells browsers and search engines the move is permanent, so the old address's place in search results passes to the new one. Browsers remember it too: deleting a redirect makes the old path show "not found" again for new visitors, but someone who already followed it may keep being sent to the new address. Make a redirect only for an address that has really moved for good.
