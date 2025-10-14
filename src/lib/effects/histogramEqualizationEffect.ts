/**
 * Compute histogram equalization lookup table from canvas image data
 */
export function computeHistogramLUT(imageData: ImageData): Uint8Array {
  const { data, width, height } = imageData;
  const numPixels = width * height;

  // Build histogram (grayscale, using luminance)
  const histogram = new Uint32Array(256).fill(0);

  for (let i = 0; i < data.length; i += 4) {
    // Convert to grayscale using luminance formula
    const luminance = Math.floor(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    );
    histogram[luminance]++;
  }

  // Compute CDF
  const cdf = new Uint32Array(256);
  cdf[0] = histogram[0];
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + histogram[i];
  }

  // Find minimum non-zero CDF value
  let cdfMin = cdf[0];
  for (let i = 0; i < 256; i++) {
    if (cdf[i] > 0) {
      cdfMin = cdf[i];
      break;
    }
  }

  // Create lookup table
  const lut = new Uint8Array(256);
  const cdfRange = numPixels - cdfMin;

  for (let i = 0; i < 256; i++) {
    if (cdfRange > 0) {
      lut[i] = Math.round(((cdf[i] - cdfMin) / cdfRange) * 255);
    } else {
      lut[i] = i;
    }
  }

  return lut;
}

/**
 * Apply histogram equalization to image data using a precomputed LUT
 */
export function applyHistogramLUT(imageData: ImageData, lut: Uint8Array): ImageData {
  const result = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );

  for (let i = 0; i < result.data.length; i += 4) {
    result.data[i] = lut[result.data[i]];       // R
    result.data[i + 1] = lut[result.data[i + 1]]; // G
    result.data[i + 2] = lut[result.data[i + 2]]; // B
    // Alpha (i + 3) stays the same
  }

  return result;
}
