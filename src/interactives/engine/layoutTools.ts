/**
 * The map's layout tools, described in one place so the footer and the code that wires them
 * cannot drift apart. No imports: a server component reads this to print the notes, and
 * pulling it out of the hook module dragged the whole client stage into the server render.
 */

/**
 * The query the map watches for, and the value that turns the layout tools on.
 *
 * A namespace rather than a switch of its own. It began as `?anchors=1`, which named half of
 * what it does — the same mode drags a region's shapes as well as a seat block's anchor — and
 * a second tool would have wanted a second boolean. `?debug=<mode>` says what kind of thing it
 * is, which matters now the footer tells readers about it: nobody should mistake it for a
 * display preference.
 */
export const DEBUG_PARAM = "debug"
export const DEBUG_LAYOUT = "layout"

/**
 * What the tools are, said out loud in the footer's info popup.
 *
 * They are not hidden because they are dangerous. Everything they touch is already in the
 * payload the page ships, and nothing they do is saved — a drag ends as a number in the
 * console, and the file it belongs in is one somebody has to edit by hand. So a reader curious
 * enough to look is welcome to them, and there is no account to check.
 */
export const LAYOUT_TOOL_NOTES = [
  { label: "Layout tools", value: `?${DEBUG_PARAM}=${DEBUG_LAYOUT}` },
  { label: "Drag", value: "a seat block, or a region's shape" },
  { label: "Reset", value: "press a piece twice" },
  { label: "Print", value: "drilldownAnchors(), drilldownOffsets()" },
] as const
