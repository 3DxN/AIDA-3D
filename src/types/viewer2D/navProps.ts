import type { ChannelMapping, ContrastLimits } from "./navTypes"
import type { NavigationHandlers, NavigationLimits, NavigationState } from "./navState"
import type { IMultiscaleInfo } from "../metadata/loader"


export interface NavigationControlsProps {
  msInfo: IMultiscaleInfo
  navigationState: NavigationState
  navigationLimits: NavigationLimits
  navigationHandlers: NavigationHandlers
}


export interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  valueDisplay?: string | ((value: number, max: number) => string)
  condition?: boolean
}


export interface ChannelMapperProps {
  channelNames: string[];
  channelMap: ChannelMapping;
  onChannelChange: (role: keyof ChannelMapping, value: number | null) => void;
}


export interface ContrastLimitsProps {
  /**
   * Current contrast limit for each channel
   */
  contrastLimits: ContrastLimits;
  /**
   * Maximum contrast limit (for all channels)
   */
  maxContrastLimit: number;
  /**
   * Callback when contrast limits change
   */
  onContrastLimitsChange: (limits: ContrastLimits) => void;
}