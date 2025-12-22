import type { ChannelMapping, ContrastLimits } from "./navTypes"


export interface NavigationState {
    xOffset: number
    yOffset: number
    zSlice: number
    timeSlice: number
    channelMap: ChannelMapping
    contrastLimits: ContrastLimits
    cellposeOverlayOn: boolean
    histogramEqualizationOn: boolean
    heStainingOn: boolean
    heStainHematoxylinWeight: number  // Hematoxylin color weight (default 2.56)
    heStainEosinWeight: number        // Eosin color weight (default 0.1)
    heStainMaxIntensity: number       // Maximum intensity for normalization (default 65535)
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
    onHEStainParamChange: (param: 'hematoxylinWeight' | 'eosinWeight' | 'maxIntensity', value: number) => void
}