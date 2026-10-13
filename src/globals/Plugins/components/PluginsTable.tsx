import type { PluginRow } from "./load"

const cell = {
  borderBottom: "1px solid var(--theme-elevation-200)",
  padding: "0.5rem 0.75rem 0.5rem 0",
  textAlign: "left",
  verticalAlign: "top",
} as const
const muted = { color: "var(--theme-elevation-650)" }
const code = { fontFamily: "ui-monospace, monospace", fontSize: "0.8125rem" }

const STATUS = {
  on: { text: "On", background: "var(--theme-success-100)", color: "var(--theme-success-900)" },
  off: { text: "Off", background: "var(--theme-warning-100)", color: "var(--theme-warning-900)" },
  unknown: {
    text: "Couldn't read",
    background: "var(--theme-warning-100)",
    color: "var(--theme-warning-900)",
  },
} as const

function Pages({ pages }: { pages: PluginRow["pages"] }): React.ReactNode {
  if (pages.length === 0) return <span style={muted}>None</span>
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {pages.map((page) => (
        <li key={page.label}>
          {page.href ? (
            <a href={page.href}>{page.label}</a>
          ) : (
            <span style={muted}>{page.label} (hidden)</span>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * The installed Payload plugins, in the order they run: where each comes from, whether it's on
 * here, and the admin pages that hold its collections and settings.
 */
export function PluginsTable({ plugins }: { plugins: PluginRow[] }): React.ReactNode {
  return (
    <div style={{ marginBottom: "2rem", overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: "0.875rem", width: "100%" }}>
        <caption style={{ fontWeight: 600, marginBottom: "0.5rem", textAlign: "left" }}>
          Installed plugins
        </caption>
        <thead>
          <tr>
            <th scope="col" style={cell}>
              Plugin
            </th>
            <th scope="col" style={cell}>
              Status
            </th>
            <th scope="col" style={cell}>
              In the admin
            </th>
          </tr>
        </thead>
        <tbody>
          {plugins.map((plugin) => {
            const status = STATUS[plugin.status]
            return (
              <tr key={plugin.name}>
                <th scope="row" style={{ ...cell, fontWeight: 400 }}>
                  <div style={{ fontWeight: 600 }}>
                    {plugin.name}
                    {plugin.beta && (
                      <span
                        style={{
                          background: "var(--theme-elevation-100)",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          marginLeft: "0.5rem",
                          padding: "0.0625rem 0.375rem",
                        }}
                      >
                        Beta
                      </span>
                    )}
                  </div>
                  <div style={{ ...muted, ...code }}>{plugin.source}</div>
                  <div style={{ marginTop: "0.25rem", maxWidth: "40rem" }}>
                    {plugin.description}
                  </div>
                </th>
                <td style={cell}>
                  <span
                    style={{
                      background: status.background,
                      borderRadius: "4px",
                      color: status.color,
                      display: "inline-block",
                      padding: "0.125rem 0.5rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {status.text}
                  </span>
                </td>
                <td style={cell}>
                  <Pages pages={plugin.pages} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
