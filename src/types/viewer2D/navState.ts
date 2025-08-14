import type { ChannelMapping, ContrastLimits } from "./navTypes"


export interface NavigationState {
  xOffset: number
  yOffset: number
  zSlice: number
  timeSlice: number
  channelMap: ChannelMapping
  contrastLimits: ContrastLimits
}

export interface NavigationLimits {
  maxXOffset: number
  maxYOffset: number
  maxZSlice: number
  maxTimeSlice: number
  numChannels: number
  maxContrastLimit: number
}

export interface NavigationHandlers {
  onXOffsetChange: (value: number) => void
  onYOffsetChange: (value: number) => void
  onZSliceChange: (value: number) => void
  onTimeSliceChange: (value: number) => void
  onChannelChange: (role: keyof ChannelMapping, value: number | null) => void
  onContrastLimitsChange: (limits: ContrastLimits) => void
}
