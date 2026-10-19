import { useEffect, useState } from 'react'

/**
 * Hook media query dengan nilai awal yang benar (tidak ada flash layout):
 * state langsung diinisialisasi dari matchMedia, bukan `false`.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (e) => setMatches(e.matches)
    setMatches(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [query])
  return matches
}

/** Desktop workbench = >=1024px, sesuai breakpoint papan v6; tablet tetap memakai alur mobile. */
export function useBreakpoint() {
  return useMediaQuery('(min-width: 1024px)')
}
