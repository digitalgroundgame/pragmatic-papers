---
name: upstream-docs
description: Read the official documentation of a tool this project runs on (Payload CMS and its Lexical editor, Coolify, GitHub Actions/REST/Projects/wikis, Cloudflare Turnstile/cache/rules/Web Analytics, Sentry for Next.js, and this repo's own GitHub wiki) from its source repository instead of the website. Use whenever you'd otherwise web-search or fetch payloadcms.com, coolify.io, docs.github.com, developers.cloudflare.com or docs.sentry.io; when a doc site is blocked or a fetch fails; or before answering from memory how one of these tools behaves, which setting or option exists, or what an API accepts. Fetches a sparse, shallow clone into .cache/upstream-docs (Payload pinned to our installed version) and says where in each repo to look.
---

# Upstream docs

Cloud agent sessions can't reach most documentation sites, and answers from memory go stale.
Every source below publishes its docs from a public GitHub repo, which plain `git` can clone
from anywhere. So clone it and search the files.

**Next.js is not here**: its docs ship with the package, in `node_modules/next/dist/docs/`
(see `AGENTS.md`). **Our own setup** comes before any vendor's docs: `dockerfiles/README.md` for
hosting, `AGENTS.md` and the code for everything else.

## Fetch, then search

```bash
pnpm tsx .claude/skills/upstream-docs/fetch-docs.ts list                 # the sources
pnpm tsx .claude/skills/upstream-docs/fetch-docs.ts payload              # prints the directory
pnpm tsx .claude/skills/upstream-docs/fetch-docs.ts sentry platform-includes/getting-started-config  # add a path
pnpm tsx .claude/skills/upstream-docs/fetch-docs.ts coolify --refresh    # move to the newest commit
```

Then use Grep/Read on `.cache/upstream-docs/<source>/…`. The first fetch takes a few seconds and
is reused after that. `.cache/` is gitignored.

- **Checkouts are sparse.** Each source fetches the paths it's usually needed for (listed in
  `fetch-docs.ts`). If a page links somewhere that isn't checked out, pass that path to add it.
  The whole repo is never downloaded.
- **Payload is pinned** to the version in `node_modules/payload`, fetched at its release tag, and
  refetched after an upgrade. The other sources track their default branch: `--refresh` when the
  question is about something recent.
- **Cite the page, not the cache.** The script prints the commit. Give people the public URL
  (each source's `site` in `fetch-docs.ts`, plus the page's path) and say when the docs may be
  newer than what we run.
- **Pages are MDX or Liquid,** with components and includes. Read through them; an include's
  text lives elsewhere in the repo (noted per source below).

## Where to look

Each guide maps our common questions to paths in that repo:

| Source       | Guide                                                | For                                                                                               |
| ------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `payload`    | [references/payload.md](references/payload.md)       | collections, fields, hooks, access, versions/drafts, Lexical, Postgres, migrations, jobs, plugins |
| `coolify`    | [references/coolify.md](references/coolify.md)       | build variables and secrets, previews, deployments and logs, Docker cleanup, rollbacks            |
| `github`     | [references/github.md](references/github.md)         | workflow syntax, events, `GITHUB_TOKEN`, REST endpoints, Projects, issue types, wikis             |
| `cloudflare` | [references/cloudflare.md](references/cloudflare.md) | Turnstile, cache and cache rules, rules, SSL, Web Analytics (RUM beacon)                          |
| `sentry`     | [references/sentry.md](references/sentry.md)         | Next.js SDK setup, `ignoreErrors`/filtering, sampling, source maps, releases                      |
| `wiki`       | [references/wiki.md](references/wiki.md)             | this repo's wiki pages: environments, releases, hotfixes, contributing                            |

## Adding a source

Add an entry to `SOURCES` in `fetch-docs.ts` (repo, branch, default paths, site; `pinTo` if the
docs are versioned with an npm package we install), add `references/<name>.md`, add it to the
table above and to the `description`, and run `pnpm exec vitest run tests/scripts/upstream-docs.test.ts`.
Only add a source we look up often; one-off questions can clone ad hoc with the same `git` flags.
