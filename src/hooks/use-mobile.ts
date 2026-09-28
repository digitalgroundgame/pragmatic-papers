import * as React from "react"

/** Tailwind's `md`, which is where this project's layouts switch from stacked to side by side. */
const MOBILE_BREAKPOINT = 768

/**
 * Whether the viewport is narrower than `md`. Starts undefined and resolves after mount, so a
 * server render and the first client render agree; callers read it as false until then.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = (): void => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    mql.addEventListener("change", onChange)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the viewport is only knowable on the client
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
