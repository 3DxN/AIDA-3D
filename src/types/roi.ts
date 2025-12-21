export interface ROI {
  id: string
  name: string
  frameCenter: [number, number]
  frameSize: [number, number]
  zSlice: number
  zLayersAbove: number
  zLayersBelow: number
  createdAt: string
}

export const generateROIId = () => `roi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
