export function isActivePath(pathname: string, url: string): boolean {
  const [path = ""] = url.split(/[?#]/)
  if (!path.startsWith("/")) return false

  const normalizedPath = path === "/" ? path : path.replace(/\/+$/, "")
  if (normalizedPath === "/") return pathname === "/"

  return pathname === normalizedPath || pathname.startsWith(`${normalizedPath}/`)
}
