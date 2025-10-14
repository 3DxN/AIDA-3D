import * as zarr from "zarrita";

/**
 * Apply histogram equalization to image data
 * @param data - The typed array containing pixel values
 * @param dtype - The data type of the array
 * @returns The equalized data
 */
export function applyHistogramEqualization<T extends zarr.TypedArray<any>>(
  data: T,
  dtype: string
): T {
  // Get min and max values based on data type
  const { min: typeMin, max: typeMax } = getTypeRange(dtype);

  // Compute histogram
  const histogram = new Array(256).fill(0);
  const dataLength = data.length;

  // Normalize values to 0-255 range for histogram computation
  for (let i = 0; i < dataLength; i++) {
    const normalizedValue = Math.floor(((data[i] as number) - typeMin) / (typeMax - typeMin) * 255);
    const binIndex = Math.max(0, Math.min(255, normalizedValue));
    histogram[binIndex]++;
  }

  // Compute cumulative distribution function (CDF)
  const cdf = new Array(256).fill(0);
  cdf[0] = histogram[0];
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + histogram[i];
  }

  // Find the minimum non-zero CDF value
  let cdfMin = cdf[0];
  for (let i = 0; i < 256; i++) {
    if (cdf[i] > 0) {
      cdfMin = cdf[i];
      break;
    }
  }

  // Create equalization lookup table
  const lut = new Array(256);
  const cdfRange = dataLength - cdfMin;

  for (let i = 0; i < 256; i++) {
    if (cdfRange > 0) {
      lut[i] = Math.round(((cdf[i] - cdfMin) / cdfRange) * 255);
    } else {
      lut[i] = i;
    }
  }

  // Apply equalization
  const result = new (data.constructor as any)(dataLength);
  for (let i = 0; i < dataLength; i++) {
    const normalizedValue = Math.floor(((data[i] as number) - typeMin) / (typeMax - typeMin) * 255);
    const binIndex = Math.max(0, Math.min(255, normalizedValue));
    const equalizedValue = lut[binIndex];
    // Map back to original data type range
    result[i] = typeMin + (equalizedValue / 255) * (typeMax - typeMin);
  }

  return result as T;
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
