# Coolify documentation (vendored)

A copy of the pages from [Coolify's documentation](https://github.com/coollabsio/coolify-docs/tree/main/content/docs) that cover how we host Pragmatic Papers: Dockerfile builds, environment variables and build secrets, PR preview deployments, the GitHub App, Docker cleanup, build servers and scheduled tasks. It's here so people and agents can answer "how does Coolify do X" from the repo. Cloud agent sessions can't reach coolify.io.

**Read `dockerfiles/README.md` first.** It records how _our_ three Coolify applications are set up and what we've verified about them. These pages describe Coolify in general.

- **Source:** `coollabsio/coolify-docs`, `content/docs/`, at the commit in [`manifest.json`](manifest.json). All pages come from that one commit.
- **Unchanged:** files in [`pages/`](pages) are byte-for-byte copies, MDX components included (`<Callout>`, `<Tabs>`, `<ZoomImage>`). Images aren't copied. Links like `/applications/…` are relative to `pages/`.
- **License:** Apache-2.0, see [`LICENSE`](LICENSE).
- **Our Coolify version isn't pinned here.** These pages track upstream docs, which may describe features newer than the instance. If a setting named here isn't in the UI, check the instance's version.

## Refreshing

```bash
pnpm docs:coolify            # newest commit on main
pnpm docs:coolify <commit>   # a specific commit
```

To add a page, add its path (relative to `content/docs/`) to `manifest.json` and rerun. Removing a path deletes the file. If upstream moves a page, the script fails without writing anything and lists the paths to fix. Review the diff before committing: a changed page can mean Coolify changed.

## Where to look

| Question                                                                               | Page                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which variables reach the build vs. the container; Build Variable / Runtime Variable   | [environment-variables](pages/applications/configuration/environment-variables.mdx)                                                                                                                               |
| Keeping secrets out of the image (**Use Docker Build Secrets**, BuildKit)              | [environment-variables](pages/applications/configuration/environment-variables.mdx), [dockerfile](pages/applications/builds/dockerfile.mdx)                                                                       |
| Predefined variables (`COOLIFY_FQDN`, `COOLIFY_URL`, `SOURCE_COMMIT`…)                 | [environment-variables](pages/applications/configuration/environment-variables.mdx)                                                                                                                               |
| Build cache, injected `ARG`s, **Include Source Commit in Build**                       | [advanced](pages/applications/configuration/advanced.mdx), [dockerfile](pages/applications/builds/dockerfile.mdx)                                                                                                 |
| PR previews: URL template, separate preview variables, what's deleted when a PR closes | [preview-deployments](pages/applications/deployments/preview-deployments.mdx), [github/preview-deploy](pages/applications/sources/github/preview-deploy.mdx)                                                      |
| How a deployment runs, its log, redeploy vs. restart                                   | [deployments/overview](pages/applications/deployments/overview.mdx), [build-deployment-model](pages/core/build-deployment-model.mdx)                                                                              |
| Rollbacks and how many images are kept                                                 | [rollbacks](pages/applications/deployments/rollbacks.mdx)                                                                                                                                                         |
| Disk filling up: Docker cleanup schedule and threshold                                 | [automated-docker-cleanup](pages/core/infrastructure/servers/automated-docker-cleanup.mdx)                                                                                                                        |
| Builds on a separate machine, registries                                               | [build-servers](pages/core/infrastructure/servers/build-servers.mdx), [docker-registries](pages/applications/builds/docker-registries.mdx)                                                                        |
| A build killed mid-way (out of memory)                                                 | [crash-during-build](pages/troubleshoot/server/crash-during-build.mdx)                                                                                                                                            |
| Running a command on a schedule (e.g. cleanup jobs)                                    | [scheduled-tasks](pages/applications/operations/scheduled-tasks.mdx), [core/automation/scheduled-tasks](pages/core/automation/scheduled-tasks/overview.mdx), [cron-syntax](pages/core/automation/cron-syntax.mdx) |
| Who can see or change what; shared variables                                           | [roles-and-permissions](pages/core/team/roles-and-permissions.mdx), [shared-variables](pages/core/team/shared-variables.mdx), [security-model](pages/core/security-model.mdx)                                     |
| Triggering deploys from CI or the API                                                  | [deploy-webhooks](pages/core/automation/deploy-webhooks.mdx), [manual-webhooks](pages/applications/deployments/manual-webhooks.mdx), [api-tokens](pages/core/security/credentials/api-tokens.mdx)                 |
| 502 / 504 from a deployed app                                                          | [bad-gateway](pages/troubleshoot/applications/bad-gateway.mdx), [gateway-timeout](pages/troubleshoot/applications/gateway-timeout.mdx)                                                                            |

Not every copied page is listed; browse [`pages/`](pages) for the rest. A page we need and don't have goes in `manifest.json`.
