# Achievements

## Achievements

`src/plugins/achievements/` gives readers achievements, behind its switch on System → Plugins.
Editors define them in the `achievements` collection (**Content → Achievements**, orderable:
name, description, `badge`, and the rule each is earned by). The rules are code (`RULES` in
`rules.ts`); an editor picks one and fills in what it asks for (`limit`). The `awards`
collection holds one row per user and achievement: an award, a revocation, or both. It's off
the sidebar (`admin.group: false`): moderators reach it from the users collection's `awards`
join field, on each user's record. Only admins delete either.

- **Rules**: `account` ones (`verified`: `isVerified`) are worked out from the user record on
  each read and have no row until a moderator revokes one; `awarded` ones (`firstMembers`) are a
  row, written by the plugin; `manual` ones are a row a moderator adds from the user's record.
  A row with `revoked` ticked suppresses any of them and keeps who and when. A row made in the
  admin either gives a `manual` achievement or revokes one (`awardChanges`). An achievement's
  rule is fixed once it's made.
- **First members** go to the first `limit` accounts `isMember` accepts (members and staff), in
  sign-up order: a users `afterChange` hook awards each such achievement when an account becomes
  one, and saving the achievement (created, or its limit raised) fills it from the accounts a
  site already has (`fillFirstMembers`). A deploy fills, once, any that was never filled
  (`markFilled`), so an award an admin deletes stays deleted. Revoked rows, and rows whose account
  was deleted (kept with no user), still count, so nobody moves up. They're awarded even while
  the switch is off.
- **Starter achievements** (`starterAchievements`): Verified (given by hand to someone the
  editors vouch for, first so its badge wins), Early member (`earlyMemberLimit`, 1000) and Email
  verified (the `verified` rule, no badge: nearly everyone has it) are created once per site by `/next/revalidate-all` and the seed
  (`readerAchievements.seed`, recorded with `markSeeded`), so one an editor deletes stays deleted.
  Each carries its starter `key` (read-only in the admin), so editors can rename it.
- **Badges on comments**: the comments plugin's `authorBadges` option asks
  `readerAchievements.badgesFor` once per thread; the first achievement in the editors' order
  with a badge shows, and a badge `describeAuthor` gives (a staff role's, `staffBadge`) wins.
  A badge is a `BadgeInfo`, its label and a `key` (the role's slug, or the starter's key; null
  for one an editor made), and `AuthorBadges` picks its icon and color by the key.
  `/api/achievements/mine` lists the signed-in reader's for `/account`. Switched off, no
  achievement shows anywhere.
- **Reading** (`reading/`): while the switch is on, the plugin also keeps what signed-in readers
  read, for reading achievements to count. Nothing is kept for readers who aren't signed in, or
  while it's off.
  - **Articles read** are rows (`articles-read`, one per reader per published article, unique on
    the pair), so a rule can ask which articles someone read: a volume counts as read once every
    article in it is (the `reading.groups` option).
  - **Visits** are fields on the user (the `reading` group: days visited, last visit day, current
    and longest streak), written at most once a day with `payload.db.updateOne`, past the users
    collection's revalidation hooks. A day is the reader's own calendar day, which the browser
    sends; the server accepts any day some time zone is on (`isCurrentDay`).
  - Pages are one cached copy for everyone, so the browser reports: `ReadingBeacon`
    (`src/components/ReadingBeacon`) in the frontend layout sends the day's visit, and after an
    article's text it sends the read once the reader reaches the end or stays two minutes in
    view. Besides the article's view count (below), it sends nothing unless the `pp-signed-in` cookie is there: sign-in sets it beside the
    session for the page's scripts to read (the session cookie is httpOnly), and it carries no
    identity or authority. `POST /api/reading` takes `{ day, article? }`; `GET
/api/reading/mine` is the account page's totals.
  - Deleting an account, or an article, deletes its reads. Only admins see them in the admin.
  - **Views** are counted for every reader, signed in or not, by the same beacon: on an article
    it sends `POST /api/articles/:id/view` once, a `fetch` that leaves the cookies out (`sendBeacon` always sends them). The host keeps a
    daily total per article in the plain `article_views` table
    (`src/collections/Articles/stats/views/`), with nothing about the reader; bots that say so
    are left out, and one address adds at most 20 views an hour to an article (kept in memory).
    It isn't behind the achievements switch. The article's Stats tab shows it as Views, beside
    Google Analytics' figures.
  - `tests/integration/reading.test.ts` signs a reader up with Discord stubbed, and reads.
- The host's options (roles, access, the starter limit, what's read) are `achievementsOptions` in
  `src/plugins/readerAchievements.ts`. `tests/integration/achievements.test.ts` covers defining,
  giving and revoking, access, and filling a first-members achievement.
