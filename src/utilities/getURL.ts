import canUseDOM from "./canUseDOM"

// SERVER_URL is read when the server runs. NEXT_PUBLIC_SERVER_URL is compiled into
// the build (server code included), so one image can only ever serve the host it was
// built for; SERVER_URL lets the same image run somewhere else, such as E2E (#1090).
const configuredServerURL = (): string | undefined =>
  process.env.SERVER_URL || process.env.NEXT_PUBLIC_SERVER_URL || undefined

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getServerSideURL = () => {
  return configuredServerURL() || "http://localhost:8000"
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getClientSideURL = () => {
  if (canUseDOM) {
    const protocol = window.location.protocol
    const domain = window.location.hostname
    const port = window.location.port

    return `${protocol}//${domain}${port ? `:${port}` : ""}`
  }

  return configuredServerURL() || ""
}
