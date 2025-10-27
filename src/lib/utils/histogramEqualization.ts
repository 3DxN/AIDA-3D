import * as zarr from "zarrita";

/**
 * Histogram equalization mapping that can be computed once and reused
 */
export class HistogramEqualizationMapping {
  private lut: number[];
  private typeMin: number;
  private typeMax: number;
  private numBins: number;

  constructor(lut: number[], typeMin: number, typeMax: number, numBins: number) {
    this.lut = lut;
    this.typeMin = typeMin;
    this.typeMax = typeMax;
    this.numBins = numBins;
  }

  /**
   * Apply the histogram equalization mapping to a chunk of data
   */
  apply<T extends zarr.TypedArray<any>>(data: T): T {
    const result = new (data.constructor as any)(data.length);

    for (let i = 0; i < data.length; i++) {
      const normalizedValue = ((data[i] as number) - this.typeMin) / (this.typeMax - this.typeMin) * (this.numBins - 1);
      const clampedValue = Math.max(0, Math.min(this.numBins - 1, normalizedValue));

      // Linear interpolation between bins
      const binIndex = Math.floor(clampedValue);
      const fraction = clampedValue - binIndex;

      let equalizedValue;
      if (binIndex >= this.numBins - 1) {
        equalizedValue = this.lut[this.numBins - 1];
      } else {
        equalizedValue = this.lut[binIndex] * (1 - fraction) + this.lut[binIndex + 1] * fraction;
      }

      // Map back to original data type range
      result[i] = this.typeMin + equalizedValue * (this.typeMax - this.typeMin);
    }

    return result as T;
  }
}

/**
 * Compute histogram equalization mapping from sample data
 * @param data - Sample data to compute the histogram from (can be full image or representative sample)
 * @param dtype - The data type of the array
 * @returns A mapping that can be applied to chunks
 */
export function computeHistogramEqualizationMapping(
  data: zarr.TypedArray<any>,
  dtype: string
): HistogramEqualizationMapping {
  const { min: typeMin, max: typeMax } = getTypeRange(dtype);
  const numBins = 4096;
  const histogram = new Array(numBins).fill(0);

  // Build histogram from sample data
  for (let i = 0; i < data.length; i++) {
    const normalizedValue = ((data[i] as number) - typeMin) / (typeMax - typeMin) * (numBins - 1);
    const binIndex = Math.max(0, Math.min(numBins - 1, Math.floor(normalizedValue)));
    histogram[binIndex]++;
  }

  // Compute cumulative distribution function (CDF)
  const cdf = new Array(numBins).fill(0);
  cdf[0] = histogram[0];
  for (let i = 1; i < numBins; i++) {
    cdf[i] = cdf[i - 1] + histogram[i];
  }

  // Find the minimum non-zero CDF value
  let cdfMin = cdf[0];
  for (let i = 0; i < numBins; i++) {
    if (cdf[i] > 0) {
      cdfMin = cdf[i];
      break;
    }
  }

  // Create equalization lookup table (normalized to 0-1)
  const lut = new Array(numBins);
  const cdfRange = data.length - cdfMin;

  for (let i = 0; i < numBins; i++) {
    if (cdfRange > 0) {
      lut[i] = (cdf[i] - cdfMin) / cdfRange;
    } else {
      lut[i] = i / (numBins - 1);
    }
  }

  return new HistogramEqualizationMapping(lut, typeMin, typeMax, numBins);
}

/**
 * Apply histogram equalization to image data (legacy single-chunk version)
 * @param data - The typed array containing pixel values
 * @param dtype - The data type of the array
 * @returns The equalized data
 */
export function applyHistogramEqualization<T extends zarr.TypedArray<any>>(
  data: T,
  dtype: string
): T {
  const mapping = computeHistogramEqualizationMapping(data, dtype);
  return mapping.apply(data);
}

/**
 * Get the valid range for a given data type
 */
function getTypeRange(dtype: string): { min: number; max: number } {
  const dtypeLower = dtype.toLowerCase();

  if (dtypeLower.includes('uint8')) {
    return { min: 0, max: 255 };
  } else if (dtypeLower.includes('uint16')) {
    return { min: 0, max: 65535 };
  } else if (dtypeLower.includes('uint32')) {
    return { min: 0, max: 4294967295 };
  } else if (dtypeLower.includes('int8')) {
    return { min: -128, max: 127 };
  } else if (dtypeLower.includes('int16')) {
    return { min: -32768, max: 32767 };
  } else if (dtypeLower.includes('int32')) {
    return { min: -2147483648, max: 2147483647 };
  } else if (dtypeLower.includes('float')) {
    // For float types, we need to find the actual min/max in the data
    // For now, assume normalized 0-1 range for float32
    return { min: 0, max: 1 };
  }

  // Default fallback
  return { min: 0, max: 255 };
}

/**
 * Get the actual min and max values from the data for float types
 */
export function getDataRange(data: zarr.TypedArray<any>): { min: number; max: number } {
  let min = data[0] as number;
  let max = data[0] as number;

  for (let i = 1; i < data.length; i++) {
    const value = data[i] as number;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  return { min, max };
}
