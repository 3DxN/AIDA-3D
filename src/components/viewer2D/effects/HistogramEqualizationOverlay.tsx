import React, { useEffect, useRef, useCallback } from 'react';
import { VivViewState } from '../../../types/viewer2D/vivViewer';

interface HistogramEqualizationOverlayProps {
  enabled: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  viewState: VivViewState | null;
  containerSize: { width: number; height: number };
}

export const HistogramEqualizationOverlay: React.FC<HistogramEqualizationOverlayProps> = ({
  enabled,
  containerRef,
  viewState,
  containerSize
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  const computeHistogramLUT = useCallback((imageData: ImageData): Uint8ClampedArray => {
    const { data, width } = imageData;
    let numValidPixels = 0;

    // Build histogram for each channel, excluding black/background pixels
    const histograms = [
      new Uint32Array(256).fill(0),  // R
      new Uint32Array(256).fill(0),  // G
      new Uint32Array(256).fill(0)   // B
    ];

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Skip fully transparent or pure black pixels (background)
      if (a === 0 || (r === 0 && g === 0 && b === 0)) {
        continue;
      }

      histograms[0][r]++;
      histograms[1][g]++;
      histograms[2][b]++;
      numValidPixels++;
    }

    // If no valid pixels, return identity LUT
    if (numValidPixels === 0) {
      const identityLUT = new Uint8ClampedArray(768);
      for (let i = 0; i < 256; i++) {
        identityLUT[i] = i;           // R
        identityLUT[256 + i] = i;     // G
        identityLUT[512 + i] = i;     // B
      }
      return identityLUT;
    }

    // Compute CDFs and LUTs for each channel
    const luts = histograms.map(histogram => {
      const cdf = new Uint32Array(256);
      cdf[0] = histogram[0];
      for (let i = 1; i < 256; i++) {
        cdf[i] = cdf[i - 1] + histogram[i];
      }

      let cdfMin = cdf[0];
      for (let i = 0; i < 256; i++) {
        if (cdf[i] > 0) {
          cdfMin = cdf[i];
          break;
        }
      }

      const lut = new Uint8ClampedArray(256);
      const cdfRange = numValidPixels - cdfMin;

      for (let i = 0; i < 256; i++) {
        if (cdfRange > 0) {
          lut[i] = Math.round(((cdf[i] - cdfMin) / cdfRange) * 255);
        } else {
          lut[i] = i;
        }
      }

      return lut;
    });

    return new Uint8ClampedArray(luts.flatMap(lut => Array.from(lut)));
  }, []);

  const applyHistogramEqualization = useCallback(() => {
    if (!enabled || !canvasRef.current || !containerRef.current || !viewState) {
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

    // Compute and apply histogram equalization
    const luts = computeHistogramLUT(imageData);
    const lutR = luts.slice(0, 256);
    const lutG = luts.slice(256, 512);
    const lutB = luts.slice(512, 768);

    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];

      // Only apply to non-background pixels
      if (a > 0 && !(r === 0 && g === 0 && b === 0)) {
        imageData.data[i] = lutR[r];         // R
        imageData.data[i + 1] = lutG[g];     // G
        imageData.data[i + 2] = lutB[b];     // B
      }
      // Alpha and background pixels stay the same
    }

    // Put the equalized image back to temp canvas
    tempCtx.putImageData(imageData, 0, 0);

    // Draw the result to the overlay canvas, scaling to match overlay dimensions
    ctx.drawImage(tempCanvas, 0, 0, canvasWidth, canvasHeight, 0, 0, overlayCanvas.width, overlayCanvas.height);
  }, [enabled, containerRef, viewState, containerSize, computeHistogramLUT]);

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
