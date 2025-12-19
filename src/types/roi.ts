export interface ROI {
  id: string
  name: string
  points: [number, number][]  // Polygon vertices [x, y] in image coords
  zRange: [number, number]    // [zMin, zMax] inclusive
  color: string
  createdAt: string
}

const COLORS = ['#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']

export const generateROIId = () => `roi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
export const generateROIColor = () => COLORS[Math.floor(Math.random() * COLORS.length)]

export function getPolygonCentroid(points: [number, number][]): [number, number] {
  const sum = points.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
  return [sum[0] / points.length, sum[1] / points.length]
}

export function getPolygonBounds(points: [number, number][]) {
  const xs = points.map(p => p[0])
  const ys = points.map(p => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return {
    center: [(minX + maxX) / 2, (minY + maxY) / 2] as [number, number],
    size: [maxX - minX, maxY - minY] as [number, number]
  }
}
