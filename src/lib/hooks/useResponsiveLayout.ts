import { useState, useEffect } from 'react'

/**
 * Hook to detect window orientation and determine if layout should be vertical or horizontal
 * Returns true if the window is in portrait/vertical mode (height > width)
 */
export function useResponsiveLayout() {
  const [isVertical, setIsVertical] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const updateLayout = () => {
      const width = window.innerWidth
      const height = window.innerHeight

      setDimensions({ width, height })
      // Consider vertical if height is greater than width
      setIsVertical(height > width)
    }

    // Initial check
    updateLayout()

    // Add resize listener
    window.addEventListener('resize', updateLayout)

    // Cleanup
    return () => window.removeEventListener('resize', updateLayout)
  }, [])

  return { isVertical, dimensions }
}
