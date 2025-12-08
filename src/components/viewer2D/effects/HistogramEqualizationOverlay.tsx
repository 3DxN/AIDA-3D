import React, { useEffect, useRef, useCallback } from 'react';
import { VivViewState } from '../../../types/viewer2D/vivViewer';
import { ChannelMapping } from '../../../types/viewer2D/navTypes';

interface HistogramEqualizationOverlayProps {
  enabled: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  viewState: VivViewState | null;
  containerSize: { width: number; height: number };
  channelMap: ChannelMapping;
}

export const HistogramEqualizationOverlay: React.FC<HistogramEqualizationOverlayProps> = ({
  enabled,
  containerRef,
  viewState,
  containerSize,
  channelMap
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const cachedLUTsRef = useRef<{ nucleus: Uint8ClampedArray | null; cytoplasm: Uint8ClampedArray | null }>({
    nucleus: null,
    cytoplasm: null
  });
  const lastComputeTimeRef = useRef<number>(0);
  const computeThrottleMs = 500; // Only recompute every 500ms

  const computeChannelIntensities = useCallback((imageData: ImageData) => {
    const { data, width } = imageData;
    const nucleusIntensities: number[] = [];
    const cytoplasmIntensities: number[] = [];

    // Downsample: only sample every 4th pixel in both dimensions for speed
    const step = 4;

    for (let i = 0; i < data.length; i += 4 * step) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Skip fully transparent or pure black pixels (background)
      if (a === 0 || (r === 0 && g === 0 && b === 0)) {
        continue;
      }

      // For false-color rendering, separate channels by color contribution
      // Default rendering: nucleus appears as blue (B channel), cytoplasm as green (G channel)
      // We extract the intensity from each color channel
      const nucleusIntensity = b; // Blue channel for nucleus
      const cytoplasmIntensity = g; // Green channel for cytoplasm

      if (nucleusIntensity > 0) {
        nucleusIntensities.push(nucleusIntensity);
      }
      if (cytoplasmIntensity > 0) {
        cytoplasmIntensities.push(cytoplasmIntensity);
      }
    }

    return { nucleusIntensities, cytoplasmIntensities };
  }, []);

  const computeHistogramLUTForChannel = useCallback((intensities: number[]): Uint8ClampedArray => {
    if (intensities.length === 0) {
      // Return identity LUT
      const identityLUT = new Uint8ClampedArray(256);
      for (let i = 0; i < 256; i++) {
        identityLUT[i] = i;
      }
      return identityLUT;
    }

    // Build histogram
    const histogram = new Uint32Array(256).fill(0);
    for (const intensity of intensities) {
      histogram[Math.min(255, Math.max(0, Math.floor(intensity)))]++;
    }

    // Step 1: Apply Gaussian smoothing for overall smoothness
    const gaussianFiltered = new Uint32Array(256);
    const kernelSize = 7;
    const sigma = 2.5;
    const kernel: number[] = [];
    let kernelSum = 0;

    // Create Gaussian kernel
    for (let i = 0; i < kernelSize; i++) {
      const x = i - Math.floor(kernelSize / 2);
      const value = Math.exp(-(x * x) / (2 * sigma * sigma));
      kernel.push(value);
      kernelSum += value;
    }

    // Normalize kernel
    for (let i = 0; i < kernelSize; i++) {
      kernel[i] /= kernelSum;
    }

    // Apply Gaussian smoothing to histogram
    for (let i = 0; i < 256; i++) {
      let sum = 0;
      for (let j = 0; j < kernelSize; j++) {
        const idx = i + j - Math.floor(kernelSize / 2);
        if (idx >= 0 && idx < 256) {
          sum += histogram[idx] * kernel[j];
        }
      }
      gaussianFiltered[i] = Math.round(sum);
    }

    // Step 2: Apply median filtering to remove remaining noise spikes
    const smoothed = new Uint32Array(256);
    const medianWindowSize = 5;

    for (let i = 0; i < 256; i++) {
      const window: number[] = [];
      const halfWindow = Math.floor(medianWindowSize / 2);

      // Collect values in window
      for (let j = -halfWindow; j <= halfWindow; j++) {
        const idx = i + j;
        if (idx >= 0 && idx < 256) {
          window.push(gaussianFiltered[idx]);
        }
      }

      // Sort and get median
      window.sort((a, b) => a - b);
      smoothed[i] = window[Math.floor(window.length / 2)];
    }

    // Compute CDF from smoothed histogram
    const cdf = new Uint32Array(256);
    cdf[0] = smoothed[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + smoothed[i];
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
    const lut = new Uint8ClampedArray(256);
    const cdfRange = cdf[255] - cdfMin;

    for (let i = 0; i < 256; i++) {
      if (cdfRange > 0) {
        lut[i] = Math.round(((cdf[i] - cdfMin) / cdfRange) * 255);
      } else {
        lut[i] = i;
      }
    }

    return lut;
  }, []);

  const applyHistogramEqualization = useCallback(() => {
    if (!enabled || !canvasRef.current || !containerRef.current || !viewState) {
      return;
    }

    // Check if both nucleus and cytoplasm are selected
    const hasNucleus = channelMap.nucleus !== null;
    const hasCytoplasm = channelMap.cytoplasm !== null;

    if (!hasNucleus && !hasCytoplasm) {
      return;
    }

    const container = containerRef.current;
    const deckCanvas = container.querySelector('canvas');

    if (!deckCanvas) {
      return;
    }

    const overlayCanvas = canvasRef.current;
    const ctx = overlayCanvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      return;
    }

    // Clear the canvas for each new render
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // Get the visible viewport dimensions from deck.gl canvas
    const canvasWidth = deckCanvas.width;
    const canvasHeight = deckCanvas.height;

    // Create a temporary canvas to extract deck.gl content
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasWidth;
    tempCanvas.height = canvasHeight;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    if (!tempCtx) {
      return;
    }

    // Draw the deck.gl canvas to temp canvas
    tempCtx.drawImage(deckCanvas, 0, 0);

    // Get image data from the temp canvas
    const imageData = tempCtx.getImageData(0, 0, canvasWidth, canvasHeight);

    // Check if we need to recompute LUTs (throttled)
    const now = Date.now();
    const shouldRecompute = now - lastComputeTimeRef.current > computeThrottleMs;

    let nucleusLUT = cachedLUTsRef.current.nucleus;
    let cytoplasmLUT = cachedLUTsRef.current.cytoplasm;

    if (shouldRecompute || !nucleusLUT || !cytoplasmLUT) {
      // Extract intensity data for each channel
      const { nucleusIntensities, cytoplasmIntensities } = computeChannelIntensities(imageData);

      // Compute histogram equalization LUTs for each channel
      nucleusLUT = hasNucleus ? computeHistogramLUTForChannel(nucleusIntensities) : null;
      cytoplasmLUT = hasCytoplasm ? computeHistogramLUTForChannel(cytoplasmIntensities) : null;

      // Cache the LUTs
      cachedLUTsRef.current = { nucleus: nucleusLUT, cytoplasm: cytoplasmLUT };
      lastComputeTimeRef.current = now;
    }

    // Apply equalization to each channel separately and combine
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];

      // Skip background pixels
      if (a === 0 || (r === 0 && g === 0 && b === 0)) {
        continue;
      }

      if (hasNucleus && hasCytoplasm && nucleusLUT && cytoplasmLUT) {
        // Both channels: apply equalization to each separately, then average
        const nucleusB = nucleusLUT[b];
        const cytoplasmG = cytoplasmLUT[g];

        // Average the two equalized contributions
        imageData.data[i] = 0;
        imageData.data[i + 1] = Math.round(cytoplasmG / 2);
        imageData.data[i + 2] = Math.round(nucleusB / 2);
      } else if (hasNucleus && nucleusLUT) {
        // Only nucleus channel - apply to blue
        imageData.data[i + 2] = nucleusLUT[b];
      } else if (hasCytoplasm && cytoplasmLUT) {
        // Only cytoplasm channel - apply to green
        imageData.data[i + 1] = cytoplasmLUT[g];
      }
    }

    // Put the equalized image back to temp canvas
    tempCtx.putImageData(imageData, 0, 0);

    // Draw the result to the overlay canvas, scaling to match overlay dimensions
    ctx.drawImage(tempCanvas, 0, 0, canvasWidth, canvasHeight, 0, 0, overlayCanvas.width, overlayCanvas.height);
  }, [enabled, containerRef, viewState, containerSize, channelMap, computeChannelIntensities, computeHistogramLUTForChannel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!enabled || !viewState) {
      // Clear the canvas when disabled
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const renderLoop = () => {
      applyHistogramEqualization();
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Clear the canvas when cleaning up
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [enabled, viewState, containerSize, applyHistogramEqualization]);

  return (
    <canvas
      ref={canvasRef}
      width={containerSize.width}
      height={containerSize.height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 5 // Behind cellpose overlay (which is at zIndex: 10)
      }}
    />
  );
};
