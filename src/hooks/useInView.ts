import { useEffect, useRef, useState } from "react"

/**
 * Observes a ref'd element with IntersectionObserver and flips `inView` to true
 * the first time it intersects. Latches — the observer disconnects after the
 * first hit, so `inView` never goes back to false.
 *
 * `options` is captured on first render; later changes are ignored.
 *
 * @example
 * const { ref, inView } = useInView<HTMLElement>({ rootMargin: "300px" })
 * return <section ref={ref}>{inView && <Heavy />}</section>
 */
export function useInView<T extends Element>(
  options?: IntersectionObserverInit,
): { ref: React.RefObject<T | null>; inView: boolean } {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  const optionsRef = useRef(options)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setInView(true)
        observer.disconnect()
      }
    }, optionsRef.current)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, inView }
}
