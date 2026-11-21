# Single sign-on

## Single sign-on

`src/plugins/sso/` signs people in with Google, Discord or Destiny.gg, behind its switch on
System → Plugins. Better Auth runs the OAuth exchange and keeps its sessions, linked accounts and
OAuth state in three plain tables (`auth_sessions`, `auth_accounts`, `auth_verifications`;
`ssoAfterSchemaInit` declares them, so they aren't collections and don't show in the admin).
Payload keeps the users, their roles and its own email and password login, which stays as the
way in when a provider is down. Its options live in `src/plugins/signIn.ts`, which the comments
plugin and the account page read too.

- **Staff and members share the `users` table, but only staff are Payload's user.**
  `isPayloadUser` (`isStaff`) decides whose session `ssoStrategy` turns into `req.user`; a
  member is anonymous to the admin, the REST API and every access rule, and the `beforeLogin`
  hook refuses them Payload's password login. Code that needs members (comments, `/account`)
  asks `getSignedInUser(req, ssoOptions)` instead of reading `req.user`.
- **Sign-up** makes a `member` (`signUp` in `signIn.ts`): only when the sign-in sends
  `requestSignUp: true` (the comment box and `/account` do, the admin's login page doesn't),
  the `comments` switch is on (System → Plugins), and the provider verified the address. Better Auth inserts
  the row with a random `member-…` slug, and `afterCreate` sets the role through Payload.
  Destiny.gg shares no address, so its sign-up gets a placeholder, `destiny-<id>@no-email.invalid`
  (`placeholderEmail.ts`: `.invalid` can't receive mail, so never send to one), and is
  unverified. Linking Google or Discord later swaps it for the address that provider verified
  (`adoptVerifiedEmail`, from Better Auth's `validateUserInfo`), unless another user has it.
- Any other provider login attaches to the user whose address the provider has verified.
- Signed in, anyone can link more accounts: staff from the **Connections** tab
  of their record (`/admin/account`), members from `/account`. `/api/auth-links` (`endpoints/links.ts`) acts on
  the signed-in user and starts the OAuth through a server-only Better Auth endpoint
  (`linking.ts`). Disconnecting ends the user's other sessions; a member's last sign-in can't
  be disconnected. Destiny.gg's PKCE challenge isn't RFC 7636's, so it's a Better Auth plugin
  (`destiny.ts`) rather than a built-in provider.
- `/api/account` (`endpoints/account.ts`) is the account page's: read it, rename (members),
  and delete the account (members only; staff are deleted by an admin).
- Better Auth's endpoints are Payload endpoints under `/api/auth/*`. The ones that would
  write to the users table (`DISABLED_PATHS`) answer 404.
- The session cookie is `pp-session`, with no `payload-token` in its name, so members get
  cached pages. Every session also gets `pp-signed-in`, readable by the page's scripts, which
  tells `ReadingBeacon` someone is signed in and grants nothing. Staff also get `payload-token-sso` (`payloadUserCookie.ts`), which carries no
  authority: the cache rules that keep signed-in editors off the edge look for it,
  `next.config.ts` and the Worker's cache (`PERSONAL_COOKIES` in `src/cloudflare/edgeCache.ts`)
  by name, and Cloudflare's rule because the name contains `payload-token`. Rename either
  everywhere or not at all.
- Payload's `csrf` list is this deployment's `SERVER_URL` (`payload.config.ts`), so its login
  cookie, and the SSO session's (`isAllowedOrigin` in `ssoStrategy`), sign nobody in on a
  request from another origin. Staging and PR previews are subdomains of the production site,
  which SameSite=Lax doesn't keep apart. The admin only works on `SERVER_URL`'s hostname.
  A page opened from another site (a link in Slack or email, a provider's redirect back after
  a sign-in) is a cross-site request too: the SSO session is still taken on a top-level page
  load, and for Payload's cookie, which isn't, `ResumeSession` (`src/components/BeforeLogin`)
  sends someone the login page finds signed in on to where they were headed.
- `staffByDefault` (`src/plugins/staffByDefault.ts`, the last plugin) gives every access rule a
  collection or plugin leaves out to staff, where Payload's default is any logged-in user, so a
  forgotten rule can't reach members if one ever becomes `req.user`.
- The provider credentials are the `googleSignIn`, `discordSignIn` and `destinySignIn`
  connections (`src/integrations`); a provider's button appears once both of its variables
  are set.
- `tests/integration/sso.test.ts` runs whole Discord sign-ins and sign-ups against the
  database, with Discord stubbed.
