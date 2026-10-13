---
title: Moderate comments
navTitle: Comments
summary: Readers sign in with Google or Discord to comment and reply under articles. Checks hold suspect comments for you, and accounts that keep breaking the rules lose commenting for a while.
publishedAt: 2026-10-18
audience: [editor]
---

Under each article, readers can comment and reply to each other. They sign in with Google or Discord, and their first sign-in makes them an account with the **Member** role. Members can comment and manage their account at /account, and nothing else: they never see the admin. Staff comment with their own accounts, marked **Staff**.

Each comment shows its author's name and picture, never their email address. Someone can post once every 20 seconds, up to 2,000 characters.

## Comments a check holds back

Before a comment goes up, it's checked. One with too many links, or one its author already posted word for word in the past day, is **held**: its author sees it, marked as waiting for a moderator, and nobody else does. It also counts against them as a **violation**.

To review held comments, open **Content → Comments** and filter **Status** by **Held by a check**. **Why it was held** says which check stopped it.

- If it's fine, set **Status** to **Published** and save. It appears for everyone, and its violation is reversed.
- If it isn't, set it to **Hidden**, or leave it as it is.

## Hide or delete a comment

1. Open **Content → Comments** and find the comment.
2. To take it off the page, set **Status** to **Hidden** and save. This counts as a violation against its author. Replies to it stay, under a note that the comment was removed. Set it back to **Published** to restore it and reverse the violation.
3. To remove it for good, use **Delete**. Deleting a comment also deletes every reply under it.

Nobody can change what someone wrote: a comment is shown, held, hidden or deleted.

## When an account loses commenting

An account with too many recent violations can't comment until enough of them expire or are reversed. The comment box tells them when they can comment again. Admins set how many violations, and how long each one lasts, in **Content → Comment settings**: three in 30 days to start.

To stop someone at once, open **Content → Violations**, create one with their account as **Author** and **Block** as **Source**, and give a reason. A block lasts until someone ticks **Reversed** on it.

To lift a violation early, open it and tick **Reversed**.

## Reply depth

Replies can nest five levels below a top-level comment. Admins change this in **Comment settings**. Lowering it never removes replies already posted; it only stops new ones past the limit, and the page says where replies stop.

## Members' own accounts

At /account, a member can change the name they comment under, connect Google, Discord or Destiny.gg, sign out, and delete their account. Deleting it removes their sign-ins and the words of their comments; replies other people wrote to them stay.

## Where it's switched on

Comments are a beta feature. Admins switch them on in **System → Settings** under **Experiments**; staging and the live site each have their own switch. See [Switch beta features on per site in Settings](/docs/experiments). Readers sign in through **Single sign-on**, so that experiment needs to be on too. While comments are off, articles show no comments, nobody can post, and nobody can make a new account, but the comments already written are kept.
