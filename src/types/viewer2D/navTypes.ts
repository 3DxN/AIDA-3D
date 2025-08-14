export type ChannelMapping = {
  nucleus: number | null; // Channel index for nucleus, null if not selected
  cytoplasm: number | null; // Channel index for cytoplasm, null if not selected
}

export type ContrastLimits = [number | null, number | null]