// Progress bar + article byline row + breathing room, shared by the hero and
// the server-rendered pages under it.
export const FEED_TOP_INSET = 64

// Elements that own their own taps and keys: the feed's gestures and shortcuts
// leave events on these alone so the control still works.
export const INTERACTIVE_SEL =
  'button, a, [role="tab"], [role="button"], input, textarea, select, label'
