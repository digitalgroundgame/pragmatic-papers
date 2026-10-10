import type { IntegrationStatus } from "@/integrations"

const cell = {
  borderBottom: "1px solid var(--theme-elevation-200)",
  padding: "0.5rem 0.75rem 0.5rem 0",
  textAlign: "left",
  verticalAlign: "top",
} as const
const muted = { color: "var(--theme-elevation-650)" }
const code = { fontFamily: "ui-monospace, monospace", fontSize: "0.8125rem" }

function Variables({ names }: { names: string[] }): React.ReactNode {
  return names.map((name, i) => (
    <span key={name}>
      {i > 0 && ", "}
      <code style={code}>{name}</code>
    </span>
  ))
}

/**
 * Whether each connection works in this environment, and which variables it's missing. Only
 * names: the statuses never carry a value.
 */
export function IntegrationStatusTable({
  statuses,
}: {
  statuses: IntegrationStatus[]
}): React.ReactNode {
  return (
    <div style={{ marginBottom: "2rem", overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: "0.875rem", width: "100%" }}>
        <caption style={{ fontWeight: 600, marginBottom: "0.5rem", textAlign: "left" }}>
          Connections in this environment
        </caption>
        <thead>
          <tr>
            <th scope="col" style={cell}>
              Connection
            </th>
            <th scope="col" style={cell}>
              Status
            </th>
            <th scope="col" style={cell}>
              To set in the hosting environment
            </th>
          </tr>
        </thead>
        <tbody>
          {statuses.map((status) => (
            <tr key={status.id}>
              <td style={cell}>
                <div style={{ fontWeight: 600 }}>{status.label}</div>
                <div style={{ ...muted, ...code }}>{status.target}</div>
              </td>
              <td style={cell}>
                <span
                  style={{
                    borderRadius: "4px",
                    display: "inline-block",
                    padding: "0.125rem 0.5rem",
                    whiteSpace: "nowrap",
                    ...(status.configured
                      ? {
                          background: "var(--theme-success-100)",
                          color: "var(--theme-success-900)",
                        }
                      : {
                          background: "var(--theme-warning-100)",
                          color: "var(--theme-warning-900)",
                        }),
                  }}
                >
                  {status.configured ? "Connected" : "Not connected"}
                </span>
              </td>
              <td style={cell}>
                {status.missing.length > 0 && (
                  <div>
                    Required: <Variables names={status.missing} />
                  </div>
                )}
                {status.unset.length > 0 && (
                  <div style={muted}>
                    Optional: <Variables names={status.unset} />
                  </div>
                )}
                {status.missing.length === 0 && status.unset.length === 0 && (
                  <span style={muted}>Nothing</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
