## What's new in 2.7.0

This release brings three new ways to read, new tools for editors, and a new safety net for contributors: every component now has an accessibility-checked Storybook, and merges into `dev` need a person to sign off. Behind the scenes, saves now reach readers right away, because the edge cache is purged when an editor saves. One image can now be deployed to any environment, because its settings are read when the server starts.

### For readers

- **Vertical article feed** at `/feed`: a full-screen, swipeable feed. Swipe up and down between articles and sideways between pages, with auto-play paced to reading speed (#707). _Behind the `feed` experiment._
- **Table of contents** on articles: a sticky sidebar of headings with linkable anchors and a toggle in the hero, for articles that turn it on (#748). _On by default._
- **Interactive pages** at `/interactives/<slug>`, starting with **Federal Courts**: an overview map you can drill into from circuits to districts to judges, kept up to date daily from the researcher's data feed (#946). _Behind the `interactives` experiment._
- **Fresh dots**: a small dot marks something you haven't tried yet until you use it, starting with the light/dark toggle (#852).
- Edits show up right away: saving content or settings now clears Cloudflare's cached copy of the site, and the header and footer no longer keep stale links when a linked page or article changes (#1117).
- The light/dark toggle now sits in the nav (#770). The lightbox only opens when you click the media itself (#772), and audio in a media block is no longer wrapped in one (#1092). Videos play from their own file again (#1088).
- RSS feeds: internal links point at the real page instead of `#`, and every CMS value is escaped (#1114).
- Fixes: math renders reliably after a slow or failed MathJax load (#1069), buttons show a pointer cursor again (#948), and pages without a description fall back to the site description for SEO (#975).

### For editors

- **Syndicate to Substack**: tick a box on an article, publish, and paste its import URL into Substack's importer (#1034).
- **Media references**: a media item's new **References** tab lists everywhere it's used. Media that published content still uses can't be deleted until you detach it (#706).
- **Clone from production**: admins on staging, previews and local can copy published production articles, with their images, authors, topics and volume (#879).
- **Experiments**: admins can switch beta features on per environment from **Site Settings → Experiments**, with no redeploy (#1052). Saving Site Settings now also purges the edge cache, so a switch takes effect for every reader at once (#1117).
- Non-admin staff can now credit article authors and media narrators (#1004).
- A link's reference and URL fields sit side by side at half width (#1123).

### For contributors

- **Storybook** for every block and component, with an axe accessibility check per story, run in CI and published for every PR (#1002, #1065, #1081). A PR's Storybook shows up as a "Storybook Preview" deployment, and the PR description links each component it changes (#1105).
- **Merge gate**: PRs into `dev` need a human approval, or a `/reviewed` or `LGTM` reply after a Claude review, either CI's or a local `/code-review --comment` (#1037, #1086, #1111, #1118). PRs now merge through GitHub's merge queue, so there's no more **Update branch** churn (#1042, #1036).
- **Weekly release train**: every Saturday a workflow opens the next "Bump package.json" candidate into `dev`, and after it has spent four days on staging, the "Release X.Y.Z" PR into `main`. People still merge both (#1104).
- **PR previews are built in GitHub Actions** and the image is deployed to Coolify, with staging's database and media copied in (#1073, #1083, #1085, #1087, #1098). They show up on the PR as GitHub Deployments (#1021). E2E now tests that same image (#1097).
- **`pnpm dev:db-seed`** seeds your local database from the terminal (#835). **`pnpm showcase`**, or the `showcase` label on a PR, pushes feature articles to a preview or staging, and the PR description links them by title (#1033, #1039, #1053, #1072).
- **Test suites**: integration and E2E tests run against a throwaway Postgres from a pre-migrated snapshot, and never touch your dev database (#1119). New coverage includes route smoke tests, navigation journeys, article interactions, hook integration tests and unit tests for hooks, SocialEmbed, block utilities and field factories (#1113, #1115, #1116).
- Every block now has a feed converter in its own `converters.ts`, with snapshot tests and a Feed story, and a test enforces it (#1027, #1114). A Docker-based workflow makes E2E screenshot baselines match CI (#982, #984).
- CI skips static checks, unit and E2E tests on Markdown-only PRs, and saves the pnpm store once (#1084, #1089).
- New Claude skills: `upstream-docs` (#1068) and a `--pending` mode for code review (#992).

### Infrastructure

- **Runtime configuration**: the server URL, analytics ID, Turnstile key, Sentry DSN and Supabase URL are read when the server starts, not compiled into the build. One image can now serve any environment (#1091, #1095), and `robots.txt` and the sitemap index are served by routes so they name the host they run on (#1096).
- **Cloudflare**: saves purge this deployment's pages from the edge cache (#1117), and the zone's Cache Rules are version-controlled and applied on release (#1103).
- **Security**: queued jobs can't be run by an anonymous caller when `CRON_SECRET` is unset (#1082). Malformed `Next-Action` probes get a 404. Routes that set their own `Cache-Control` are no longer overridden, and `/admin`, `/api` and `/_next/image` are never cached publicly (#1101, #1106, #1112).
- Preview builds no longer disrupt staging's database, and closed PRs' preview databases get cleaned up (#1062, #1070).
- Database credentials are kept out of build logs and the image (#1064). Docker builds are faster, with caching and recovery from a corrupt Turbopack cache (#991, #1026). The builder's PostgreSQL client matches the server's major version (#1074).
- The server warns when media storage is empty or unwritable, and refuses to start without the URL or storage settings it needs (#1091, #1094, #1095).
- Payload logs are readable in production (#1102), and a script prunes old images from the registry (#1078).
- Sentry is upgraded to v11 with restricted data collection. Previews report as their own environment, and releases are named at build time (#1017, #1061, #986, #1020).
- Dependency updates: vite, testcontainers, lucide-react, setup-node. Dependabot now groups Payload packages (#1014, #1010, #1006, #1005, #1012).

### Upgrade notes

- **Migrations (6):** the Payload 3.90 bump, Substack syndication, Site Settings, interactives, table of contents, and the table-of-contents experiment. All are additive.
- **Experiments start off on production** except the table of contents. To launch the feed or interactive pages, an admin ticks them in production's **Site Settings → Experiments**.
- **Rename these in Coolify before deploying.** The old names have no fallback. Give each new one both **Build Variable** and **Runtime Variable**:
  - `NEXT_PUBLIC_SERVER_URL` → `SERVER_URL` (`https://pragmaticpapers.com` on production)
  - `NEXT_PUBLIC_SUPABASE_URL` → `SUPABASE_URL` (`https://<project>.supabase.co`, no trailing slash)
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` → `TURNSTILE_SITE_KEY`
  - `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` → `GOOGLE_ANALYTICS_ID`
  - `NEXT_PUBLIC_SENTRY_DSN` → `SENTRY_DSN`. `SENTRY_DSN` now covers the browser too.

  The container **refuses to start** without `SERVER_URL`, or with S3 storage and no valid `SUPABASE_URL` or `S3_BUCKET`. Coolify then keeps the previous container running.
- **New variables:**
  - `COURT_TRACKER_GITHUB_TOKEN`, needed for the Federal Courts daily sync.
  - `CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_PURGE_TOKEN` (Zone → Cache Purge → Purge on the site's zone only), for the edge-cache purge. Without them, saves skip the purge and readers can see the old page for up to 10 minutes, or a day served stale.
- **Remove** `NEXT_PUBLIC_SENTRY_ENVIRONMENT`. `BUILD_ENV` now decides the Sentry environment.
- **`CRON_SECRET`:** leave it unset and only logged-in users can trigger queued jobs. If you set it, use a different value per environment.

**Full changelog:** https://github.com/digitalgroundgame/pragmatic-papers/compare/v2.6.0...v2.7.0
