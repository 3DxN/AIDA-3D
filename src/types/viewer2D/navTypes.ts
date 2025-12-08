export type ChannelMapping = {
  nucleus: number | null; // Channel index for nucleus, null if not selected
  cytoplasm: number | null; // Channel index for cytoplasm, null if not selected
}

// Each channel has [lower, upper] contrast limits, or null if not selected
export type ContrastLimits = [[number, number] | null, [number, number] | null]