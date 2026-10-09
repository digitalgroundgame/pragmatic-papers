import type { Decorator } from "@storybook/nextjs-vite"

/**
 * Payload's admin theme variables (light theme, from @payloadcms/ui's styles), for
 * stories of admin-panel components rendered outside the admin. Without them the
 * `var(--theme-*)` colors resolve to nothing and axe checks the wrong contrast.
 */
const lightTheme = {
  "--theme-bg": "rgb(255, 255, 255)",
  "--theme-text": "rgb(47, 47, 47)",
  "--theme-elevation-50": "rgb(245, 245, 245)",
  "--theme-elevation-100": "rgb(235, 235, 235)",
  "--theme-elevation-200": "rgb(208, 208, 208)",
  "--theme-elevation-300": "rgb(181, 181, 181)",
  "--theme-elevation-650": "rgb(87, 87, 87)",
  "--theme-success-100": "rgb(218, 237, 248)",
  "--theme-success-900": "rgb(19, 44, 58)",
  "--theme-warning-100": "rgb(248, 232, 219)",
  "--theme-warning-500": "rgb(185, 108, 13)",
  "--theme-warning-900": "rgb(56, 38, 20)",
} as React.CSSProperties

export const withPayloadAdminTheme: Decorator = (Story) => (
  <div
    style={{
      ...lightTheme,
      background: "var(--theme-bg)",
      color: "var(--theme-text)",
      fontFamily: "system-ui, sans-serif",
      padding: "1rem",
    }}
  >
    <Story />
  </div>
)
