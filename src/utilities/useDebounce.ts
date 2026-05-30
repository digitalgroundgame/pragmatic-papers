import { useEffect, useState } from "react"

/**
 * Custom React hook that debounces a value.
 *
 * Returns a debounced version of the input value that only updates after the specified
 * delay in milliseconds. Useful for performance optimization of user input such as
 * search fields or validation.
 *
 * @template T
 * @param value - The value to debounce.
 * @param delay - The debounce delay in milliseconds (default: 200).
 * @returns The debounced value.
 *
 * @example
 * const debouncedValue = useDebounce(inputValue, 500)
 */
export function useDebounce<T>(value: T, delay = 200): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
