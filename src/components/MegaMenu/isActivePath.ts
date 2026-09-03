export function isActivePath(pathname: string, url: string | null): boolean {
  if (!url?.startsWith("/")) return false

  const normalizedUrl = url === "/" ? url : url.replace(/\/+$/, "")
  if (normalizedUrl === "/") return pathname === "/"

  return pathname === normalizedUrl || pathname.startsWith(`${normalizedUrl}/`)
}
