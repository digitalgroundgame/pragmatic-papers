# GitHub docs (`github/docs`, `content/`)

Site: `https://docs.github.com/en/<path without .md>`. Pages are Markdown with Liquid:
`{% data reusables.x.y %}` is the file `data/reusables/x/y.md` (Actions reusables are checked
out; add `data/reusables/<dir>` for others), and `{% ifversion %}` blocks for GitHub Enterprise
can be ignored. **REST pages don't list endpoint parameters**: those are generated from the
OpenAPI description. For an endpoint's exact fields, add `src/rest/data` (large) or read the
response of the real call.

| Question                                                                | Path under `content/`                                                                                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflow YAML: `on`, `jobs`, `permissions`, `concurrency`, `if`         | `actions/reference/workflows-and-actions/workflow-syntax.md`                                                                                            |
| Which events trigger workflows, and their filters                       | `actions/reference/workflows-and-actions/events-that-trigger-workflows.md`                                                                              |
| `github`, `env`, `secrets`… contexts; expressions                       | `actions/reference/workflows-and-actions/contexts.md`, `expressions.md`                                                                                 |
| `GITHUB_TOKEN` scopes and what it can't trigger                         | `actions/concepts/security/github_token.md`, `actions/tutorials/authenticate-with-github_token.md`                                                      |
| Secrets and variables                                                   | `actions/reference/security/secrets.md`, `actions/reference/workflows-and-actions/variables.md`                                                         |
| Caching, artifacts, workflow commands (`::error::`)                     | `actions/reference/workflows-and-actions/dependency-caching.md`, `workflow-commands.md`, `actions/concepts/workflows-and-actions/workflow-artifacts.md` |
| `workflow_dispatch`, re-running jobs                                    | `actions/how-tos/manage-workflow-runs/manually-run-a-workflow.md`, `re-run-workflows-and-jobs.md`                                                       |
| Environments and deployments (our preview Deployments)                  | `actions/reference/workflows-and-actions/deployments-and-environments.md`, `rest/deployments/deployments.md`, `rest/deployments/statuses.md`            |
| Limits (job time, concurrency, API calls from Actions)                  | `actions/reference/limits.md`                                                                                                                           |
| REST: issues, labels, comments, PRs, reviews, check runs, workflow runs | `rest/issues/`, `rest/pulls/`, `rest/checks/runs.md`, `rest/actions/workflow-runs.md`                                                                   |
| REST rate limits and pagination                                         | `rest/using-the-rest-api/rate-limits-for-the-rest-api.md`, `best-practices-for-using-the-rest-api.md`                                                   |
| Projects: fields, built-in automations, API                             | `issues/planning-and-tracking-with-projects/` (`understanding-fields/`, `automating-your-project/`)                                                     |
| Issue types, sub-issues                                                 | `issues/tracking-your-work-with-issues/using-issues/`                                                                                                   |
| Wikis: editing, sidebar/footer, cloning                                 | `communities/documenting-your-project-with-wikis/`                                                                                                      |
| Webhooks: events and payloads                                           | `webhooks/webhook-events-and-payloads.md`, `webhooks/`                                                                                                  |

For this repo's conventions on issues, labels and the board, use the `github-issues` skill.
