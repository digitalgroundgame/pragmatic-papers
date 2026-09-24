/**
 * Sets a field on an issue's item in the "Pragmatic Papers Development" board.
 *
 * Run from the repo root:
 *   pnpm tsx .claude/skills/github-issues/set-project-field.ts <issue> <field> <value>
 *   pnpm tsx .claude/skills/github-issues/set-project-field.ts <issue> <field> --clear
 *
 *   … 953 Priority P2
 *   … 953 Size M
 *   … 953 Estimate 3
 *   … 953 "Start date" 2026-10-01
 *
 * One GraphQL query resolves the project, the issue's board item, and every
 * field with its options by name, so a renamed option or recreated field can't
 * leave a stale ID behind. Adds the issue to the board first if it isn't on it.
 * Needs the `project` token scope. `.github/workflows/project-fields.yml`
 * resolves by name the same way for remote sessions; change both together.
 */
import { execFileSync } from "node:child_process"
import { pathToFileURL } from "node:url"

export const OWNER = "digitalgroundgame"
export const REPO = "pragmatic-papers"
export const PROJECT = 3

export type Gh = (args: string[]) => string

export interface Field {
  id: string
  name: string
  dataType: string
  options: { id: string; name: string }[]
}

export interface Board {
  projectId: string
  issueUrl: string
  itemId: string | null
  fields: Field[]
}

const QUERY = `
  query($owner: String!, $repo: String!, $project: Int!, $issue: Int!) {
    organization(login: $owner) {
      projectV2(number: $project) {
        id
        fields(first: 50) {
          nodes {
            ... on ProjectV2FieldCommon { id name dataType }
            ... on ProjectV2SingleSelectField { options { id name } }
          }
        }
      }
    }
    repository(owner: $owner, name: $repo) {
      issue(number: $issue) {
        url
        projectItems(first: 20) { nodes { id project { number } } }
      }
    }
  }`

interface QueryResult {
  data: {
    organization: {
      projectV2: {
        id: string
        fields: {
          nodes: { id: string; name: string; dataType: string; options?: Field["options"] }[]
        }
      } | null
    }
    repository: {
      issue: {
        url: string
        projectItems: { nodes: { id: string; project: { number: number } }[] }
      } | null
    }
  }
}

export function parseBoard(json: string, issue: number, project = PROJECT): Board {
  const { data } = JSON.parse(json) as QueryResult
  const board = data.organization.projectV2
  if (!board) throw new Error(`Project ${project} not found on ${OWNER}.`)
  const found = data.repository.issue
  if (!found) throw new Error(`Issue #${issue} not found in ${OWNER}/${REPO}.`)

  return {
    projectId: board.id,
    issueUrl: found.url,
    itemId: found.projectItems.nodes.find((n) => n.project.number === project)?.id ?? null,
    fields: board.fields.nodes.map((f) => ({ ...f, options: f.options ?? [] })),
  }
}

/** The `gh project item-edit` flags that set `value` on the named field. */
export function editFlags(fields: Field[], name: string, value: string): string[] {
  const field = fields.find((f) => f.name === name)
  if (!field) {
    throw new Error(
      `No field named "${name}" on project ${PROJECT}. Fields: ${fields.map((f) => f.name).join(", ")}`,
    )
  }

  const target = ["--field-id", field.id]
  if (value === "--clear") return [...target, "--clear"]

  switch (field.dataType) {
    case "SINGLE_SELECT": {
      const option = field.options.find((o) => o.name === value)
      if (!option) {
        throw new Error(
          `"${value}" isn't an option of ${name}. Options: ${field.options.map((o) => o.name).join(", ")}`,
        )
      }
      return [...target, "--single-select-option-id", option.id]
    }
    case "NUMBER":
      if (value.trim() === "" || !Number.isFinite(Number(value))) {
        throw new Error(`${name} takes a number, got "${value}".`)
      }
      return [...target, "--number", value]
    case "DATE":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error(`${name} takes a YYYY-MM-DD date, got "${value}".`)
      }
      return [...target, "--date", value]
    case "TEXT":
      return [...target, "--text", value]
    default:
      throw new Error(
        `${name} is a ${field.dataType} field the board mirrors from the issue; set it with \`gh issue edit\` instead.`,
      )
  }
}

function runGh(args: string[]): string {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
}

export function setProjectField(
  issue: number,
  name: string,
  value: string,
  gh: Gh = runGh,
): string {
  const board = parseBoard(
    gh([
      "api",
      "graphql",
      "-f",
      `query=${QUERY}`,
      "-F",
      `owner=${OWNER}`,
      "-F",
      `repo=${REPO}`,
      "-F",
      `project=${PROJECT}`,
      "-F",
      `issue=${issue}`,
    ]),
    issue,
  )
  // Resolve the edit before touching the board, so a typo can't add the issue as a side effect.
  const flags = editFlags(board.fields, name, value)

  let itemId = board.itemId
  if (!itemId) {
    const added = gh([
      "project",
      "item-add",
      String(PROJECT),
      "--owner",
      OWNER,
      "--url",
      board.issueUrl,
      "--format",
      "json",
    ])
    itemId = (JSON.parse(added) as { id: string }).id
  }

  gh(["project", "item-edit", "--project-id", board.projectId, "--id", itemId, ...flags])

  const added = board.itemId ? "" : ` (added #${issue} to project ${PROJECT})`
  return value === "--clear"
    ? `#${issue} ${name} cleared${added}`
    : `#${issue} ${name} → ${value}${added}`
}

export function main(argv: string[], gh: Gh = runGh): number {
  const [issueArg, name, value] = argv
  const issue = Number(issueArg)
  if (argv.length !== 3 || !Number.isInteger(issue) || issue <= 0 || !name || value === undefined) {
    console.error(
      "Usage: pnpm tsx .claude/skills/github-issues/set-project-field.ts <issue> <field> <value|--clear>",
    )
    return 2
  }

  try {
    console.warn(setProjectField(issue, name, value, gh))
    return 0
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr
    console.error(stderr?.trim() || (error as Error).message)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)))
}
