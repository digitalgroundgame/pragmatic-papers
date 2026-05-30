import canUseDOM from "./canUseDOM"

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getServerSideURL = () => {
  return process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8000"
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getClientSideURL = () => {
  if (canUseDOM) {
    const protocol = window.location.protocol
    const domain = window.location.hostname
    const port = window.location.port

    return `${protocol}//${domain}${port ? `:${port}` : ""}`
  }

  return process.env.NEXT_PUBLIC_SERVER_URL || ""
}
