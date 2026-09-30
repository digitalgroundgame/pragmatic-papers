import { spawnSync } from "node:child_process"
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const SCRIPTS = resolve(__dirname, "../../dockerfiles/scripts")
const PASSWORD = "hunter2-s3cret"
const URI = `postgres://app:${PASSWORD}@db.internal:5432/pragmatic_papers?sslmode=require`
const PREVIEW_URI = URI.replace("pragmatic_papers?", "pragmatic_papers_pr_330?")

// Fake psql, pg_dump, pg_restore, pnpm, node and wget. Each logs its name and arguments to
// $CALLS_LOG, one line per call. psql answers the "does the target exist?" query from
// $TARGET_EXISTS and, while $SOURCE_BUSY is set, refuses a template copy the way Postgres
// does while anything is connected to the template. pnpm also logs the DATABASE_URI it
// migrated. $DUMP_STATUS, $RESTORE_STATUS and $MIGRATE_STATUS make those steps fail;
// $SERVER_VERSION_NUM and $CLIENT_VERSION set the server's and pg_dump's versions.
const FAKES: Record<string, string> = {
  psql: `case "$*" in
  *"shobj_description"*) echo "$DATABASE_COMMENT" ;;
  *"FROM pg_database"*) [ "$TARGET_EXISTS" = "true" ] && echo 1 ;;
  *"server_version_num"*) echo "\${SERVER_VERSION_NUM:-170006}" ;;
  *"WITH TEMPLATE"*) if [ "$SOURCE_BUSY" = "true" ]; then
    echo 'ERROR:  source database "pragmatic_papers" is being accessed by other users' >&2; exit 1; fi ;;
esac
exit 0`,
  pg_dump: `[ "$1" = "--version" ] && echo "pg_dump (PostgreSQL) \${CLIENT_VERSION:-17.6}" && exit 0
for arg; do case "$arg" in --file=*) : > "\${arg#--file=}" ;; esac; done
exit "\${DUMP_STATUS:-0}"`,
  pg_restore: `exit "\${RESTORE_STATUS:-0}"`,
  pnpm: `echo "migrated DATABASE_URI=$DATABASE_URI" >> "$CALLS_LOG"
exit "\${MIGRATE_STATUS:-0}"`,
  node: `[ "$1" = "--version" ] && echo v24 && exit 0
echo "node started with DATABASE_URI=$DATABASE_URI"`,
  wget: `case "$*" in *revalidate-all*) exit "\${REFRESH_STATUS:-0}" ;; esac`,
}
const LOG_CALL = `echo "$(basename "$0") $*" | tr '\\n' ' ' >> "$CALLS_LOG"; echo >> "$CALLS_LOG"`

let dir: string
let nameFile: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "preview-database-"))
  nameFile = join(dir, "database_name")
  mkdirSync(join(dir, "bin"))
  for (const [name, body] of Object.entries(FAKES)) {
    writeFileSync(join(dir, "bin", name), `#!/bin/sh\n${LOG_CALL}\n${body}\n`)
    chmodSync(join(dir, "bin", name), 0o755)
  }
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

// Runs `script` in sh with the helpers sourced, the way the Dockerfile's RUN steps do.
function sh(script: string, env: Record<string, string> = {}) {
  const result = spawnSync("sh", ["-c", `. "${SCRIPTS}/database-uri.sh"; ${script}`], {
    encoding: "utf-8",
    env: {
      ...process.env,
      PATH: `${join(dir, "bin")}:${process.env.PATH}`,
      CALLS_LOG: join(dir, "calls.log"),
      DATABASE_NAME_FILE: nameFile,
      SOURCE_DATABASE_NAME: "",
      COPY_SOURCE_DATABASE: "",
      FORCE_DATABASE_COPY: "",
      // start.sh refuses a deployed image without SERVER_URL, or with S3 storage and no
      // usable SUPABASE_URL; a .env loaded into process.env mustn't decide that for a test.
      BUILD_ENV: "",
      SERVER_URL: "",
      USE_LOCAL_STORAGE: "true",
      SUPABASE_URL: "",
      S3_BUCKET: "",
      TARGET_EXISTS: "",
      SOURCE_BUSY: "",
      BUILT_WITHOUT_DATABASE: "",
      SOURCE_COMMIT: "",
      DATABASE_COMMENT: "",
      ...env,
    },
  })
  return { status: result.status, output: result.stdout + result.stderr }
}

const calls = () => readFileSync(join(dir, "calls.log"), "utf-8").trim().split("\n")

describe("database-uri.sh", () => {
  it("redacts only the password", () => {
    expect(sh(`redact_uri "${URI}"`).output.trim()).toBe(
      "postgres://app:****@db.internal:5432/pragmatic_papers?sslmode=require",
    )
    expect(sh(`redact_uri "postgres://db.internal/pp"`).output.trim()).toBe(
      "postgres://db.internal/pp",
    )
  })

  it("swaps the database and keeps the options", () => {
    expect(sh(`uri_database "${URI}"`).output.trim()).toBe("pragmatic_papers")
    expect(sh(`uri_with_database "${URI}" other`).output.trim()).toBe(
      `postgres://app:${PASSWORD}@db.internal:5432/other?sslmode=require`,
    )
  })

  it("use_preview_database leaves DATABASE_URI alone when no name was written", () => {
    writeFileSync(nameFile, "")
    const { output } = sh(
      `use_preview_database "${nameFile}"; echo "$DATABASE_URI|$SOURCE_DATABASE_NAME"`,
      { DATABASE_URI: URI },
    )
    expect(output.trim()).toBe(`${URI}|`)
  })
})

describe("preview database build", () => {
  const preview = { BUILD_ENV: "preview", COOLIFY_FQDN: "pr-330.pragmaticpapers.com" }

  it("names the preview database without writing or printing the password", () => {
    const { status, output } = sh(`sh "${SCRIPTS}/modify-database-uri.sh"`, {
      ...preview,
      DATABASE_URI: URI,
    })

    expect(status).toBe(0)
    expect(readFileSync(nameFile, "utf-8").trim()).toBe("pragmatic_papers_pr_330")
    expect(output).not.toContain(PASSWORD)
    expect(output).toContain("postgres://app:****@db.internal:5432/pragmatic_papers_pr_330")
  })

  it("writes an empty name outside previews", () => {
    writeFileSync(nameFile, "stale_name")
    const { status, output } = sh(`sh "${SCRIPTS}/modify-database-uri.sh"`, {
      BUILD_ENV: "staging",
      DATABASE_URI: URI,
    })

    expect(status).toBe(0)
    expect(readFileSync(nameFile, "utf-8")).toBe("")
    expect(output).not.toContain(PASSWORD)
  })

  it("copies the original database into the preview database", () => {
    const { status, output } = sh(
      `sh "${SCRIPTS}/modify-database-uri.sh" && use_preview_database "${nameFile}" && ` +
        `echo "URI=$DATABASE_URI" && sh "${SCRIPTS}/copy-database.sh"`,
      { ...preview, DATABASE_URI: URI, COPY_SOURCE_DATABASE: "true" },
    )

    expect(status).toBe(0)
    expect(output).toContain(`URI=${PREVIEW_URI}`)
    expect(output.replace(/^URI=.*$/m, "")).not.toContain(PASSWORD)
    const create = calls().at(-1)
    expect(create).toContain(
      'CREATE DATABASE "pragmatic_papers_pr_330" WITH TEMPLATE "pragmatic_papers"',
    )
    // Connects to the server's maintenance database, not either copy.
    expect(create).toMatch(
      /^psql postgres:\/\/app:.*@db\.internal:5432\/postgres\?sslmode=require /,
    )
  })

  it("leaves an existing preview database alone", () => {
    const { status, output } = sh(`sh "${SCRIPTS}/copy-database.sh"`, {
      DATABASE_URI: PREVIEW_URI,
      SOURCE_DATABASE_NAME: "pragmatic_papers",
      COPY_SOURCE_DATABASE: "true",
      TARGET_EXISTS: "true",
    })

    expect(status).toBe(0)
    expect(output).toContain("already exists")
    expect(calls()).toHaveLength(1)
  })

  it("fails a preview that can't name its database instead of sharing one (#1058)", () => {
    const { status, output } = sh(`sh "${SCRIPTS}/modify-database-uri.sh"`, {
      BUILD_ENV: "preview",
      COOLIFY_FQDN: "",
      DATABASE_URI: URI,
    })

    expect(status).toBe(1)
    expect(output).toContain("COOLIFY_FQDN is not set")
    expect(readFileSync(nameFile, "utf-8")).toBe("")
  })

  const copyToPreview = (env: Record<string, string> = {}) =>
    sh(`sh "${SCRIPTS}/copy-database.sh"`, {
      DATABASE_URI: PREVIEW_URI,
      SOURCE_DATABASE_NAME: "pragmatic_papers",
      COPY_SOURCE_DATABASE: "true",
      ...env,
    })
  // Any statement that disconnects clients of the source database.
  const disconnectsSource = () =>
    calls().some(
      (call) => call.includes("pg_terminate_backend") && call.includes("'pragmatic_papers'"),
    )
  const indexOf = (text: string) => calls().findIndex((call) => call.includes(text))

  it("falls back to dump/restore rather than disconnecting a busy source (#1057)", () => {
    const { status, output } = copyToPreview({ SOURCE_BUSY: "true" })

    expect(status).toBe(0)
    expect(output).toContain("falling back to dump/restore")
    expect(output).not.toContain(PASSWORD)
    expect(disconnectsSource()).toBe(false)
    expect(calls()).toContainEqual(
      expect.stringMatching(
        /^pg_dump .*--dbname=postgres:\/\/app:.*\/pragmatic_papers\?sslmode=require/,
      ),
    )
    expect(calls()).toContainEqual(
      expect.stringMatching(
        /^pg_restore .*--dbname=postgres:\/\/app:.*\/pragmatic_papers_pr_330\?sslmode=require/,
      ),
    )
  })

  it.each([
    ["pg_dump", { DUMP_STATUS: "1" }],
    ["pg_restore", { RESTORE_STATUS: "1" }],
  ])("drops the half-restored copy when %s fails, so the next build copies again", (_, env) => {
    const { status, output } = copyToPreview({ SOURCE_BUSY: "true", ...env })

    expect(status).toBe(1)
    expect(output).toContain("pg_dump/pg_restore failed")
    expect(calls().at(-1)).toContain('DROP DATABASE IF EXISTS "pragmatic_papers_pr_330"')
  })

  it.each([
    ["older", "16.4"],
    ["newer", "18.0"],
  ])("refuses to dump with a %s pg_dump than the server, before creating anything", (_, client) => {
    const { status, output } = copyToPreview({ SOURCE_BUSY: "true", CLIENT_VERSION: client })

    expect(status).toBe(1)
    expect(output).toContain(`pg_dump major version: ${client.split(".")[0]}; server: 17`)
    expect(output).toContain("Install postgresql17-client")
    expect(indexOf('CREATE DATABASE "pragmatic_papers_pr_330";')).toBe(-1)
    expect(calls().some((call) => call.startsWith("pg_dump --format"))).toBe(false)
  })

  it("migrates a forced copy beside the live one before swapping it in (#1058)", () => {
    const { status, output } = copyToPreview({ TARGET_EXISTS: "true", FORCE_DATABASE_COPY: "true" })

    expect(status).toBe(0)
    expect(output).not.toContain(PASSWORD)
    const steps = [
      'DROP DATABASE IF EXISTS "pragmatic_papers_pr_330_incoming"',
      'CREATE DATABASE "pragmatic_papers_pr_330_incoming" WITH TEMPLATE "pragmatic_papers"',
      "migrated DATABASE_URI=postgres://app:hunter2-s3cret@db.internal:5432/pragmatic_papers_pr_330_incoming?sslmode=require",
      'DROP DATABASE IF EXISTS "pragmatic_papers_pr_330";',
      'ALTER DATABASE "pragmatic_papers_pr_330_incoming" RENAME TO "pragmatic_papers_pr_330"',
    ].map(indexOf)
    expect(steps.every((step) => step >= 0)).toBe(true)
    expect(steps).toEqual([...steps].sort((a, b) => a - b))
    expect(disconnectsSource()).toBe(false)
  })

  it("leaves a forced copy for the app to migrate in an image built without a database (#1067)", () => {
    const { status, output } = copyToPreview({
      TARGET_EXISTS: "true",
      FORCE_DATABASE_COPY: "true",
      BUILT_WITHOUT_DATABASE: "true",
    })

    expect(status).toBe(0)
    expect(output).toContain("for the app to migrate")
    expect(calls().some((call) => call.startsWith("pnpm"))).toBe(false)
    expect(indexOf('RENAME TO "pragmatic_papers_pr_330"')).toBeGreaterThan(
      indexOf('WITH TEMPLATE "pragmatic_papers"'),
    )
  })

  it("forces a copy once per image, so a restart keeps the preview's data (#1067)", () => {
    const image = {
      TARGET_EXISTS: "true",
      FORCE_DATABASE_COPY: "true",
      BUILT_WITHOUT_DATABASE: "true",
      SOURCE_COMMIT: "abc123",
    }

    const restart = copyToPreview({ ...image, DATABASE_COMMENT: "copied for commit abc123" })
    expect(restart.status).toBe(0)
    expect(restart.output).toContain("a restart keeps its data")
    expect(indexOf("DROP DATABASE")).toBe(-1)

    rmSync(join(dir, "calls.log"), { force: true })
    const newImage = copyToPreview({ ...image, DATABASE_COMMENT: "copied for commit old999" })
    expect(newImage.status).toBe(0)
    expect(indexOf('RENAME TO "pragmatic_papers_pr_330"')).toBeGreaterThanOrEqual(0)
    expect(
      indexOf(`COMMENT ON DATABASE "pragmatic_papers_pr_330" IS 'copied for commit abc123'`),
    ).toBeGreaterThan(indexOf('RENAME TO "pragmatic_papers_pr_330"'))
  })

  it("marks a first copy with the image's commit, and leaves Coolify builds unmarked", () => {
    copyToPreview({ BUILT_WITHOUT_DATABASE: "true", SOURCE_COMMIT: "abc123" })
    expect(indexOf("COMMENT ON DATABASE")).toBeGreaterThan(indexOf("WITH TEMPLATE"))

    rmSync(join(dir, "calls.log"), { force: true })
    copyToPreview({ SOURCE_COMMIT: "abc123" })
    expect(indexOf("COMMENT ON DATABASE")).toBe(-1)
  })

  it("keeps the live preview database when the forced copy fails to migrate", () => {
    const { status } = copyToPreview({
      TARGET_EXISTS: "true",
      FORCE_DATABASE_COPY: "true",
      MIGRATE_STATUS: "1",
    })

    expect(status).not.toBe(0)
    expect(indexOf('DROP DATABASE IF EXISTS "pragmatic_papers_pr_330";')).toBe(-1)
  })

  it("never copies onto a database that isn't a preview's", () => {
    const { status, output } = sh(`sh "${SCRIPTS}/copy-database.sh"`, {
      DATABASE_URI: URI,
      COPY_SOURCE_DATABASE: "true",
    })

    expect(status).toBe(0)
    expect(output).toContain("isn't a preview database")
  })
})

describe("start.sh", () => {
  // Lays out /app as the runner image does: start.sh, the helpers and the name file.
  // `media` lays out public/media with those files; `mediaMode` then sets its permissions.
  function start(name: string, env: Record<string, string>, media?: string[], mediaMode?: number) {
    const app = join(dir, "app")
    mkdirSync(app)
    if (media) {
      mkdirSync(join(app, "public", "media"), { recursive: true })
      for (const file of media) writeFileSync(join(app, "public", "media", file), file)
      if (mediaMode !== undefined) chmodSync(join(app, "public", "media"), mediaMode)
    }
    for (const script of [
      "start.sh",
      "database-uri.sh",
      "modify-database-uri.sh",
      "copy-database.sh",
    ]) {
      copyFileSync(join(SCRIPTS, script), join(app, script))
      chmodSync(join(app, script), 0o755)
    }
    writeFileSync(join(app, "database_name"), name)
    return sh(`cd "${app}" && sh ./start.sh`, env)
  }

  it("points a preview at its own database", () => {
    const { status, output } = start("pragmatic_papers_pr_330\n", { DATABASE_URI: URI })

    expect(status).toBe(0)
    expect(output).toContain(`node started with DATABASE_URI=${PREVIEW_URI}`)
  })

  it("uses DATABASE_URI as-is outside previews", () => {
    const { status, output } = start("", { DATABASE_URI: URI })

    expect(status).toBe(0)
    expect(output).toContain(`node started with DATABASE_URI=${URI}`)
  })

  it("refuses to start without a runtime DATABASE_URI", () => {
    const { status, output } = start("pragmatic_papers_pr_330\n", { DATABASE_URI: "" })

    expect(status).toBe(1)
    expect(output).toContain("DATABASE_URI is not set at runtime")
    expect(output).not.toContain("node started")
  })

  describe("with local storage", () => {
    const local = { DATABASE_URI: URI, USE_LOCAL_STORAGE: "true" }

    it("warns when the media folder is empty, as when its host folder was deleted", () => {
      const { status, output } = start("", local, [])

      expect(status).toBe(0)
      expect(output).toContain("public/media is empty")
      expect(output).toContain("node started")
    })

    it("warns when there's no media folder at all", () => {
      const { output } = start("", local)

      expect(output).toContain("public/media doesn't exist")
    })

    // Root can write anywhere, so this only means something as another user.
    it.skipIf(process.getuid?.() === 0)("warns when the app can't write its uploads", () => {
      const { status, output } = start("", local, ["photo.webp"], 0o555)
      chmodSync(join(dir, "app", "public", "media"), 0o755)

      expect(status).toBe(0)
      expect(output).toContain("isn't writable")
      expect(output).toContain("node started")
    })

    it("says nothing about a folder that holds files", () => {
      const { output } = start("", local, ["photo.webp"])

      expect(output).not.toMatch(/public\/media (is empty|doesn't exist|isn't writable)/)
    })

    it("leaves the media folder alone with S3 storage", () => {
      // Explicit: CI runs the tests with USE_LOCAL_STORAGE=true, which the scripts inherit.
      const { output } = start("", { DATABASE_URI: URI, USE_LOCAL_STORAGE: "false" }, [])

      expect(output).not.toContain("public/media")
    })
  })

  // A deployed image without SERVER_URL would publish localhost links (#1090).
  it("refuses to start a deployed image without a runtime SERVER_URL", () => {
    const { status, output } = start("", { DATABASE_URI: URI, BUILD_ENV: "production" })

    expect(status).toBe(1)
    expect(output).toContain("SERVER_URL is not set at runtime")
    expect(output).not.toContain("node started")
  })

  it("starts a deployed image that has SERVER_URL", () => {
    const { status, output } = start("", {
      DATABASE_URI: URI,
      BUILD_ENV: "production",
      SERVER_URL: "https://pragmaticpapers.com",
    })

    expect(status).toBe(0)
    expect(output).toContain("node started")
  })

  // Media URLs point at SUPABASE_URL, and next/image only loads *.supabase.co (#1090).
  describe("a deployed image on S3 storage", () => {
    const production = {
      DATABASE_URI: URI,
      BUILD_ENV: "production",
      SERVER_URL: "https://pragmaticpapers.com",
      USE_LOCAL_STORAGE: "false",
      S3_BUCKET: "media",
    }

    it("starts with a Supabase project URL", () => {
      const { status, output } = start("", {
        ...production,
        SUPABASE_URL: "https://abcdefgh.supabase.co",
      })

      expect(status).toBe(0)
      expect(output).toContain("node started")
    })

    it("refuses to start without SUPABASE_URL", () => {
      const { status, output } = start("", production)

      expect(status).toBe(1)
      expect(output).toContain("SUPABASE_URL is not set at runtime")
      expect(output).not.toContain("node started")
    })

    // #791: media URLs fell back to /media/<file>, which doesn't exist with S3 storage.
    it("refuses to start without S3_BUCKET", () => {
      const { status, output } = start("", {
        ...production,
        SUPABASE_URL: "https://abcdefgh.supabase.co",
        S3_BUCKET: "",
      })

      expect(status).toBe(1)
      expect(output).toContain("S3_BUCKET is not set at runtime")
      expect(output).not.toContain("node started")
    })

    it.each(["https://media.pragmaticpapers.com", "https://abcdefgh.supabase.co/"])(
      "refuses to start with %s, which next/image won't load",
      (url) => {
        const { status, output } = start("", { ...production, SUPABASE_URL: url })

        expect(status).toBe(1)
        expect(output).toContain(`SUPABASE_URL must be https://<project>.supabase.co`)
        expect(output).not.toContain("node started")
      },
    )

    it("doesn't need SUPABASE_URL on local storage", () => {
      const { status } = start("", { ...production, USE_LOCAL_STORAGE: "true" })

      expect(status).toBe(0)
    })
  })

  describe("in an image built without a database (#1067)", () => {
    const built = {
      BUILT_WITHOUT_DATABASE: "true",
      BUILD_ENV: "preview",
      SERVER_URL: "https://pr-330.pragmaticpapers.com",
      COOLIFY_FQDN: "pr-330.pragmaticpapers.com",
      COPY_SOURCE_DATABASE: "true",
      PAYLOAD_SECRET: "payload-s3cret",
      PORT: "3000",
      DATABASE_URI: URI,
    }

    it("names and copies the preview's database, cleans up, then starts on it", () => {
      // The build wrote no name: this image names the database from the runtime COOLIFY_FQDN.
      const { status, output } = start("", built)

      expect(status).toBe(0)
      // The fake node prints the URI it was given; nothing else may.
      expect(output.replace(/^node started with .*$/gm, "")).not.toContain(PASSWORD)
      const steps = [
        'CREATE DATABASE "pragmatic_papers_pr_330" WITH TEMPLATE "pragmatic_papers"',
        "drop-closed-preview-databases.ts",
        "node server.js",
      ].map((text) => calls().findIndex((call) => call.includes(text)))
      expect(steps.every((step) => step >= 0)).toBe(true)
      expect(steps).toEqual([...steps].sort((a, b) => a - b))
      expect(output).toContain(`node started with DATABASE_URI=${PREVIEW_URI}`)
    })

    it("refreshes the prerendered routes once the server answers", () => {
      const { output } = start("", built)

      // The refresh runs beside the server, so their log lines can interleave: check the
      // order across the whole log rather than line by line.
      const log = calls().join("\n")
      const ready = log.indexOf("http://127.0.0.1:3000/api/users/me")
      const refresh = log.indexOf(
        "--header=Authorization: Bearer payload-s3cret http://127.0.0.1:3000/next/revalidate-all",
      )
      expect(ready).toBeGreaterThanOrEqual(0)
      expect(refresh).toBeGreaterThan(ready)
      expect(output).toContain("Prerendered routes refreshed from pragmatic_papers_pr_330")
    })

    it("still serves when the refresh fails", () => {
      const { status, output } = start("", { ...built, REFRESH_STATUS: "1" })

      expect(status).toBe(0)
      expect(output).toContain("node started")
    })

    it("copies staging's media without overwriting the preview's own", () => {
      // The image's cp is BusyBox's: with -n it skips a source whose own destination
      // exists. For `cp -Rn staging/. media/` that's media/. itself, so it copied
      // nothing. Stand in for it: GNU cp recurses into the folder instead.
      writeFileSync(
        join(dir, "bin", "cp"),
        `#!/bin/sh
case "$1" in -*n*) shift ;; *) exec /bin/cp "$@" ;; esac
for last; do :; done
status=0
while [ $# -gt 1 ]; do
  src=$1; shift
  if [ -d "$last" ]; then dest="$last/$(basename "$src")"; else dest=$last; fi
  [ -e "$dest" ] || /bin/cp -R "$src" "$dest" || status=1
done
exit $status
`,
      )
      chmodSync(join(dir, "bin", "cp"), 0o755)
      const staging = join(dir, "staging-media")
      mkdirSync(staging)
      writeFileSync(join(staging, "new.webp"), "staging")
      writeFileSync(join(staging, "Screenshot at 5.49 PM.webp"), "staging")
      writeFileSync(join(staging, "same.webp"), "staging")
      const { output } = start(
        "",
        { ...built, USE_LOCAL_STORAGE: "true", STAGING_MEDIA_DIR: staging },
        ["same.webp"],
      )

      const media = join(dir, "app", "public", "media")
      expect(readFileSync(join(media, "new.webp"), "utf8")).toBe("staging")
      expect(readFileSync(join(media, "Screenshot at 5.49 PM.webp"), "utf8")).toBe("staging")
      expect(readFileSync(join(media, "same.webp"), "utf8")).toBe("same.webp")
      expect(output).toContain("Media: copied 2, now 3 files")
      expect(output).not.toContain("public/media is empty")
    })

    it("says so when staging's media folder is empty", () => {
      const staging = join(dir, "staging-media")
      mkdirSync(staging)
      const { status, output } = start("", { ...built, STAGING_MEDIA_DIR: staging }, [])

      expect(status).toBe(0)
      expect(output).toContain(`ERROR: ${staging} is empty`)
      expect(output).toContain("node started")
    })

    it("fails a preview that can't name its database instead of sharing one (#1058)", () => {
      const { status, output } = start("", { ...built, COOLIFY_FQDN: "" })

      expect(status).toBe(1)
      expect(output).not.toContain("node started")
    })
  })
})
