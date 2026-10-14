import type { ComponentType } from "react"

import type { PluginRow } from "./load"
import { PluginSwitch } from "./PluginSwitch"

const cell = {
  borderBottom: "1px solid var(--theme-elevation-200)",
  padding: "0.5rem 0.75rem 0.5rem 0",
  textAlign: "left",
  verticalAlign: "top",
} as const
const muted = { color: "var(--theme-elevation-650)" }
const code = { fontFamily: "ui-monospace, monospace", fontSize: "0.8125rem" }

/** What a plugin without a switch shows on hover over its disabled one. */
const FIXED = {
  on: "Always on: this plugin has no switch.",
  off: "Switched off in code.",
  unknown: "Couldn't read whether it's on.",
} as const

/** A switchable plugin's switch, bound to the form (`PluginSwitchField` in the admin). */
export type SwitchFieldComponent = ComponentType<{ name: string; path: string }>

function Status({
  plugin,
  SwitchField,
}: {
  plugin: PluginRow
  SwitchField: SwitchFieldComponent
}): React.ReactNode {
  if (plugin.switchPath) return <SwitchField name={plugin.name} path={plugin.switchPath} />
  return (
    <span style={{ alignItems: "center", display: "inline-flex", gap: "0.5rem" }}>
      <PluginSwitch
        name={plugin.name}
        checked={plugin.status === "on"}
        disabled
        title={FIXED[plugin.status]}
      />
      {plugin.status === "unknown" && <span style={muted}>Couldn&apos;t read</span>}
    </span>
  )
}

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
 * here, and the admin pages that hold its collections and settings. A plugin that offers a switch
 * shows it in its Status cell, bound to the form through `SwitchField`; any other shows a disabled
 * one in the position it's in.
 */
export function PluginsTable({
  plugins,
  SwitchField,
}: {
  plugins: PluginRow[]
  SwitchField: SwitchFieldComponent
}): React.ReactNode {
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
          {plugins.map((plugin) => (
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
                <div style={{ marginTop: "0.25rem", maxWidth: "40rem" }}>{plugin.description}</div>
              </th>
              <td style={cell}>
                <Status plugin={plugin} SwitchField={SwitchField} />
              </td>
              <td style={cell}>
                <Pages pages={plugin.pages} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ ...muted, margin: "0.5rem 0 0" }}>
        Switch a plugin off and save, and it stops at once, without a deploy. Its data stays.
      </p>
    </div>
  )
}
