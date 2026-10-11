---
title: Hide a post from the ticker
navTitle: Ticker
summary: The ticker under the header shows our live broadcasts and latest posts. Editors can keep a post out of it by pasting its link.
publishedAt: 2026-10-09
heroImage: ticker-hero.webp
heroAlt: The ticker showing a live YouTube broadcast beside our latest posts
audience: [editor]
---

The ticker is the strip under the site's header. It shows readers what we're doing outside the site:

- **A live broadcast**, when one of our YouTube channels is live or about to go live.
- **Our latest posts** from Bluesky and X, scrolling past.

It fills itself in: YouTube is checked every few minutes, Bluesky every few minutes and X about every half hour. There's nothing to publish.

## Hide a post

If a post shouldn't run on the site, an editor can take it out:

1. Copy the post's link with its **Share** button on Bluesky or X.
2. In the admin, open **Site → Header** and go to the **Ticker** tab.
3. Click **Hide** beside the post under **Posts right now**, or paste its link under **Hidden posts**.
4. Save. It's gone from the ticker straight away.

The link has to be a bsky.app or x.com post link; anything else is refused with a message saying so. Remove the row to let the post back in.

## Choosing whose posts run

Admins choose the YouTube channels, Bluesky accounts and X accounts in **System → Integrations**. See [Change the header, footer and other site-wide settings](/docs/globals).

## Where it's switched on

Admins switch the ticker on and off at the top of the same **Ticker** tab in **Site → Header**. Staging and the live site each have their own switch. While it's off, readers don't see it and the posts and hidden list are out of the way.
