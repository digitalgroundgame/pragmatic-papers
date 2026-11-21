# Tests

## Test databases

`pnpm test:integration`, `pnpm test:e2e` and `node scripts/check-pending-migrations.mjs`
get their database from `startTestDatabase()` in `scripts/test-db.mjs`. They never read
`DATABASE_URI` (that's your dev database in `.env`); they only set it for the Payload
processes they start.

- By default it `docker run`s `postgres:17-alpine` on a random localhost port and removes
  it on exit, Ctrl-C or SIGTERM. A container left by a `kill -9` is swept by the next run.
- It pulls Docker Hub's official image through Amazon's mirror,
  `public.ecr.aws/docker/library/`, as `docker-compose.yml` and both Dockerfiles do:
  Docker Hub rate-limits anonymous pulls. CI pulls its copy in GHCR instead
  (`ghcr.io/digitalgroundgame/postgres:17-alpine`, set by `TEST_DB_IMAGE` and used by
  every Postgres service), logged in with the job's `GITHUB_TOKEN`, because GitHub's
  shared runners share their IPs and ran out of ECR Public's anonymous pulls too.
  `.github/workflows/ci-images.yml` refreshes that copy weekly, along with a GHCR copy of
  the Node image the CI Dockerfile builds on (`ghcr.io/digitalgroundgame/node`), which
  `build-app-image` pulls logged in, falling back to `mirror.gcr.io` (then ECR Public)
  until the copy exists.
- Integration and E2E start from a **pre-migrated snapshot image**
  (`pragmatic-papers-test-db:<hash>`, keyed on `src/migrations/**` and the Postgres image),
  so they skip `payload migrate` until a migration changes; a miss migrates once and commits
  a new one. The pending-migrations check always replays from scratch, and CI (`CI` set)
  never uses a snapshot. `docker image rm` the tags to force a fresh migrate.
- `TEST_DATABASE_URI` points them at an existing database instead (CI's E2E jobs, whose
  containers can't start their own). It is refused if it names the same database as
  `DATABASE_URI` in `.env`.
