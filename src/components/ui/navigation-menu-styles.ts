// The navigation menu's classes, apart from navigation-menu.tsx so markup that stands in for
// the menu until it loads (MegaMenu's) can match it without importing base-ui's menu.

export const navigationMenuClassName =
  "group/navigation-menu relative flex max-w-max flex-1 items-center justify-center"

export const navigationMenuListClassName =
  "group flex flex-1 list-none items-center justify-center gap-0"

export const navigationMenuLinkClassName =
  "hover:bg-muted focus:bg-muted focus-visible:ring-ring/50 data-active:bg-muted/50 data-active:hover:bg-muted data-active:focus:bg-muted flex items-center gap-2 rounded-sm p-2 text-sm transition-all outline-none focus-visible:ring-3 focus-visible:outline-1 in-data-[slot=navigation-menu-content]:rounded-md [&_svg:not([class*='size-'])]:size-4"
