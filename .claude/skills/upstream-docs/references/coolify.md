# Coolify docs (`coollabsio/coolify-docs`, `content/docs/`)

Tracks upstream `main`, which may describe features newer than our instance; if a setting isn't
in the UI, check the instance's version. Site: `https://coolify.io/docs/<path without .mdx>`.
How **our** two applications (development: staging + PR previews; production) are set up is in
`dockerfiles/README.md`; read that first.

| Question                                                                                                | Path under `content/docs/`                                                                           |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Which variables reach the build vs. the container (**Build Variable** / **Runtime Variable**)           | `applications/configuration/environment-variables.mdx`                                               |
| Keeping secrets out of images (**Use Docker Build Secrets**; falls back to build args without BuildKit) | same page, "Build and runtime scope"; `applications/builds/dockerfile.mdx`                           |
| Predefined variables (`COOLIFY_FQDN`, `COOLIFY_URL`, `SOURCE_COMMIT`…)                                  | `applications/configuration/environment-variables.mdx`                                               |
| Build cache, **Inject Build Args to Dockerfile**, **Include Source Commit in Build**                    | `applications/configuration/advanced.mdx`                                                            |
| PR previews: URL template, separate preview variables, what's deleted on close                          | `applications/deployments/preview-deployments.mdx`, `applications/sources/github/preview-deploy.mdx` |
| A deployment's log, redeploy vs. restart                                                                | `applications/deployments/overview.mdx`, `core/build-deployment-model.mdx`                           |
| Rollbacks and image retention                                                                           | `applications/deployments/rollbacks.mdx`                                                             |
| Disk filling up: Docker cleanup threshold, what it deletes                                              | `core/infrastructure/servers/automated-docker-cleanup.mdx`                                           |
| Builds on another machine, registries                                                                   | `core/infrastructure/servers/build-servers.mdx`, `applications/builds/docker-registries.mdx`         |
| A build killed mid-way (out of memory)                                                                  | `troubleshoot/server/crash-during-build.mdx`                                                         |
| Scheduled commands (e.g. a cleanup job)                                                                 | `applications/operations/scheduled-tasks.mdx`, `core/automation/scheduled-tasks/`                    |
| Who can see what; shared variables                                                                      | `core/team/roles-and-permissions.mdx`, `core/team/shared-variables.mdx`, `core/security-model.mdx`   |
| Deploy webhooks and the API                                                                             | `core/automation/deploy-webhooks.mdx`, `core/security/credentials/api-tokens.mdx`                    |
| 502/504 from a deployed app                                                                             | `troubleshoot/applications/bad-gateway.mdx`, `gateway-timeout.mdx`                                   |

Things these pages say that matter to us: old images are kept for rollback
and Docker cleanup skips them unless **Disable Application Image Retention** is on; the docs
describe no way to clear a deployment's log; a preview's containers are deleted when its PR
closes, but data it wrote to an external database is not.
