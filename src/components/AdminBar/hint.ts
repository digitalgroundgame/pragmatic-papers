/**
 * Set in localStorage while someone is logged in to Payload, so the next page can make room for
 * the admin bar before it paints rather than shifting everything down once the bar loads. Their
 * session cookie is httpOnly and the layout is prerendered, so nothing else can tell that early.
 * `pp:` keeps the site's own keys apart from the ones libraries write.
 */
export const ADMIN_BAR_HINT_KEY = "pp:admin-bar"

/** On `<html>` while the hint is set: the admin bar's slot is shown, and holds its height. */
export const ADMIN_BAR_ATTRIBUTE = "data-admin-bar"

/**
 * Runs in `<head>`, before the first paint. A reader who has never logged in only pays for this
 * line: no JavaScript chunk, and no gap. Private mode and blocked site data can make
 * localStorage throw, which reads as logged out.
 */
export const ADMIN_BAR_HINT_SCRIPT = `try{localStorage.getItem("${ADMIN_BAR_HINT_KEY}")&&document.documentElement.setAttribute("${ADMIN_BAR_ATTRIBUTE}","")}catch(e){}`

/** Whether the last page saw someone logged in. */
export function readAdminBarHint(): boolean {
  try {
    return localStorage.getItem(ADMIN_BAR_HINT_KEY) !== null
  } catch {
    return false
  }
}

/** Record whether someone is logged in, and show or collapse the bar's slot on this page. */
export function writeAdminBarHint(loggedIn: boolean): void {
  document.documentElement.toggleAttribute(ADMIN_BAR_ATTRIBUTE, loggedIn)
  try {
    if (loggedIn) localStorage.setItem(ADMIN_BAR_HINT_KEY, "1")
    else localStorage.removeItem(ADMIN_BAR_HINT_KEY)
  } catch {
    // Storage is full or blocked; this page is still right, the next one shifts once.
  }
}
