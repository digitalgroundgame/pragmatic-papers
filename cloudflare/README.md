# Cloudflare rules

The zone's rules live here, one file per [ruleset phase](https://developers.cloudflare.com/ruleset-engine/reference/phases-list/)
in `rulesets/`, and `scripts/cloudflare-rules.ts` keeps Cloudflare in step with them:

| File                                        | Dashboard             |
| ------------------------------------------- | --------------------- |
| `rulesets/http_request_cache_settings.json` | Caching → Cache Rules |

Change a rule by editing its file in a PR, not in the dashboard. The
**Cloudflare rules** workflow (`.github/workflows/cloudflare-rules.yml`):

- on a PR, prints what would change in the job summary (`plan`);
- on a push to `main`, applies it (`apply`). The zone serves production, staging
  and every PR preview, so a rule goes live with a release;
- every Monday, fails when Cloudflare no longer matches `main`'s files (`check`).

## Rules

Each rule has the fields of the [Rulesets API](https://developers.cloudflare.com/api/resources/rulesets/)
it's sent as: `description` (the dashboard's "Rule name"), `expression`,
`action`, `action_parameters`, and `enabled` (omitted means `true`). A long
`expression` can be an array of lines, joined with spaces. The order of the rules
is the order Cloudflare runs them in.

A rule is known by its `description`, which must be unique in its file: renaming
one deletes it and creates a new one. `apply` replaces a phase's rules whole, so
it refuses to delete a rule that is only in Cloudflare unless given `--prune`.

## A change made in the dashboard

When the weekly check fails, or a rule had to change in a hurry, copy
Cloudflare's rules into the files and commit them:

```sh
CLOUDFLARE_ZONE_ID=… CLOUDFLARE_RULES_TOKEN=… node scripts/cloudflare-rules.ts export
```

`export <phase>` adds a phase that has no file yet, such as
`http_request_dynamic_redirect` (Single Redirects).

## Secrets

Two Cloudflare API tokens, each scoped to this zone alone, so that a PR can read
the rules but only a release can change them:

| Secret                        | Where                                 | Permission                     | Used by         |
| ----------------------------- | ------------------------------------- | ------------------------------ | --------------- |
| `CLOUDFLARE_ZONE_ID`          | repository                            | (the zone's ID, Overview page) | every run       |
| `CLOUDFLARE_RULES_READ_TOKEN` | repository                            | **Zone → Cache Rules → Read**  | `plan`, `check` |
| `CLOUDFLARE_RULES_TOKEN`      | the **`cloudflare` environment** only | **Zone → Cache Rules → Edit**  | `apply`         |

Set up the `cloudflare` environment in **Settings → Environments** with
**Deployment branches and tags → Selected branches and tags → `main`**. GitHub
then gives its secrets only to runs on `main`: a PR's run is on
`refs/pull/<n>/merge`, so it can't reach the Edit token even from a workflow
file the PR changes. The Edit token must **not** also be a repository secret,
which every PR's run could read.

`plan` and `check` skip themselves without their secrets (fork and Dependabot
PRs never get them); `apply` fails instead, so a release's rules never quietly
stay unapplied.

A phase added later needs its permission on both tokens (Single Redirects need
**Zone → Dynamic URL Redirects**, for example). Keep both apart from
`CLOUDFLARE_API_TOKEN`, which only deploys Storybook.

To run the script locally, set `CLOUDFLARE_RULES_TOKEN` to either token: the
read one is enough for `plan`, `check` and `export`.
