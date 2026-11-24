# Comments

## Comments

`src/plugins/comments/` puts comments under articles, behind its switch on System → Plugins, which
needs Single sign-on on too (readers have no other way to sign in). It
doesn't sign anyone in: `currentUser` (here `getSignedInUser`) says who is commenting, staff
or member, and staff get a badge.

- The article page doesn't render comments. `src/components/Comments` loads them from
  `GET /api/comments/thread/:id` once the reader scrolls near, and posts to the same path, so
  the page stays one cached copy for everyone.
- **Replies** store `parent` and `depth`. The reply depth is in the **Comment settings** global
  (admins), checked only when a reply is posted, so lowering it never touches old threads.
  A removed comment with replies still showing comes back as a placeholder (`thread.ts`).
- **Checks** run on each post (`checks.ts`: link limit, repeated comment, plus the `checks`
  option). A failure saves the comment as `auto-hidden`, shown only to its author, and adds a
  violation. A moderator hiding a published comment adds one too; publishing a held or hidden
  one reverses it (`recordModeration`).
- **Per article**, the plugin adds a `commenting` choice to the target collection's sidebar
  (moderators, and whoever the `commentingEditors` option names: here a writer on their own
  article, `canChooseArticleCommenting`): `open`, `locked` (the thread stays readable, marked
  `closed`, and posts get 403) or `off` (the section is hidden and the thread answers 404). It's
  read from the published version, so a change reaches readers once the article is published
  (`commentingOf`): a writer's choice on a live article waits in their draft for an editor.
- **Require a verified email address** (off by default) in Comment settings limits posting
  to authors `isVerified` accepts: staff, or a provider-verified `emailVerified`.
- **Violations** (`comment-violations`) lock commenting once the settings' threshold is active
  within its window, until enough age out or are reversed (`lockFor`); a `block` locks until
  it's reversed.
- **Markers that come and go** sit beside the badge (`markers.ts`): First comment on an
  author's first published comment (`PublicComment.firstComment`), New commenter for
  `newCommenterDays` (7) after it (`AuthorDisplay.newcomer`), New member for `newMemberDays`
  (30) after the account's `createdAt` (`newMember`), and Cake day on its anniversary
  (`cakeDay`, UTC). All four read the author's record, so a thread read asks nothing more: the
  first two read `firstCommentedAt`, a read-only field the plugin adds to users and keeps at
  their earliest published comment's time (`hooks/firstCommented.ts`, run whenever a comment
  is posted, published, hidden or deleted).
- Deleting an article deletes its comments. Deleting a comment deletes its replies. Deleting a
  user empties their comments (status `deleted`, no author) so others' replies keep their place.
- `tests/integration/comments.test.ts` signs readers up with Discord stubbed, and posts.
