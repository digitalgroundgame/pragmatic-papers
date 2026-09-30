import canUseDOM from "./canUseDOM"

// SERVER_URL is read when the server runs, not compiled in like a NEXT_PUBLIC_ variable
// (which Next inlines into server code too), so one image can serve any host (#1090).
// Browser code never needs it: getClientSideURL reads the page's own origin there.

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getServerSideURL = () => {
  return process.env.SERVER_URL || "http://localhost:8000"
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getClientSideURL = () => {
  if (canUseDOM) {
    const protocol = window.location.protocol
    const domain = window.location.hostname
    const port = window.location.port

    return `${protocol}//${domain}${port ? `:${port}` : ""}`
  }

  return process.env.SERVER_URL || ""
}
