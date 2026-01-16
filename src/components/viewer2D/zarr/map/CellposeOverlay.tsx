import React, { useEffect, useRef } from 'react';
import { useViewer2DData } from '../../../../lib/contexts/Viewer2DDataContext';
import { useZarrStore } from '../../../../lib/contexts/ZarrStoreContext';
import { useNucleusSelection } from '../../../../lib/contexts/NucleusSelectionContext';
import { useNucleusColor } from '../../../../lib/contexts/NucleusColorContext';
import { VivViewState } from '../../../../types/viewer2D/vivViewer';

interface CellposeOverlayProps {
    viewState: VivViewState | null;
    containerSize: { width: number; height: number };
}

export const CellposeOverlay: React.FC<CellposeOverlayProps> = ({ viewState, containerSize }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const {
        navigationState,
        frameBoundCellposeData,
        frameZLayersAbove,
        frameZLayersBelow,
        frameCenter,
        frameSize,
        isDataLoading,
        full3DMode,
        cellposeOverlayOpacity
    } = useViewer2DData();
    const { msInfo } = useZarrStore();
    const { selectedNucleiIndices } = useNucleusSelection();
    const { getNucleusColor } = useNucleusColor();

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        if (!ctx || !canvas || !viewState) {
            return;
        }

        // Clear the canvas for each new render
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const { cellposeOverlayOn, zSlice } = navigationState;

        // Hide overlay when data is loading or when no data is available
        if (cellposeOverlayOn && frameBoundCellposeData && !isDataLoading) {
            // --- 1. Project world coordinates to screen coordinates ---
            const { target, zoom } = viewState;
            const scale = Math.pow(2, zoom);

            // In Full 3D Mode: use full image dimensions; otherwise use frame bounds
            const effectiveFrameSize: [number, number] = full3DMode && msInfo?.shape.x && msInfo?.shape.y
                ? [msInfo.shape.x, msInfo.shape.y]
                : frameSize;
            const effectiveFrameCenter: [number, number] = full3DMode && msInfo?.shape.x && msInfo?.shape.y
                ? [msInfo.shape.x / 2, msInfo.shape.y / 2]
                : frameCenter;

            // Top-left corner of the frame in world coordinates
            const frameWorldX = effectiveFrameCenter[0] - effectiveFrameSize[0] / 2;
            const frameWorldY = effectiveFrameCenter[1] - effectiveFrameSize[1] / 2;

            // Convert to screen coordinates
            const screenX = (frameWorldX - target[0]) * scale + containerSize.width / 2;
            const screenY = (frameWorldY - target[1]) * scale + containerSize.height / 2;
            const screenWidth = effectiveFrameSize[0] * scale;
            const screenHeight = effectiveFrameSize[1] * scale;

            // --- 2. Extract the 2D slice data (now a single Z layer from high-res overlay) ---
            const { data, shape } = frameBoundCellposeData;
            if (!shape || shape.length < 2) return;

            // Data is now 2D: [height, width] instead of 3D: [z, height, width]
            const height = shape[0];
            const width = shape[1];

            // Since we already fetched a single Z slice, use the data directly
            const sliceData = data;
            const imageData = new Uint8ClampedArray(width * height * 4);

            // Calculate alpha value from opacity percentage
            const alpha = Math.round((cellposeOverlayOpacity / 100) * 255);

            // First pass: render all nuclei with their colors (same opacity for selected/unselected)
            for (let i = 0; i < sliceData.length; i++) {
                const nucleusIndex = sliceData[i];
                const isNucleus = nucleusIndex > 0;

                if (isNucleus) {
                    // Get color from 3D viewer, fallback to default colors
                    const threeDColor = getNucleusColor(nucleusIndex);

                    if (threeDColor) {
                        // Use 3D viewer color
                        const r = Math.floor(threeDColor.r * 255);
                        const g = Math.floor(threeDColor.g * 255);
                        const b = Math.floor(threeDColor.b * 255);

                        imageData[i * 4] = r;       // R
                        imageData[i * 4 + 1] = g;   // G
                        imageData[i * 4 + 2] = b;   // B
                        imageData[i * 4 + 3] = alpha; // A (user-controlled opacity)
                    } else {
                        // Fallback to default color
                        imageData[i * 4] = 128;     // R (Grey)
                        imageData[i * 4 + 1] = 128; // G
                        imageData[i * 4 + 2] = 128; // B
                        imageData[i * 4 + 3] = alpha; // A (user-controlled opacity)
                    }
                } else {
                    imageData[i * 4 + 3] = 0; // Transparent
                }
            }

            // Second pass: draw white outlines OUTSIDE selected nuclei
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const i = y * width + x;
                    const nucleusIndex = sliceData[i];

                    // Only draw outline on pixels that are NOT part of a selected nucleus
                    if (!selectedNucleiIndices.includes(nucleusIndex)) {
                        // Check if any immediate neighbor is a selected nucleus
                        let adjacentToSelected = false;

                        // Check 4-connected neighbors (up, down, left, right)
                        const neighbors = [
                            { dx: 0, dy: -1 },  // up
                            { dx: 0, dy: 1 },   // down
                            { dx: -1, dy: 0 },  // left
                            { dx: 1, dy: 0 },   // right
                        ];

                        for (const { dx, dy } of neighbors) {
                            const nx = x + dx;
                            const ny = y + dy;

                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                const neighborIdx = ny * width + nx;
                                const neighborNucleus = sliceData[neighborIdx];

                                if (selectedNucleiIndices.includes(neighborNucleus)) {
                                    adjacentToSelected = true;
                                    break;
                                }
                            }
                        }

                        if (adjacentToSelected) {
                            // Draw white outline pixel
                            imageData[i * 4] = 255;     // R
                            imageData[i * 4 + 1] = 255; // G
                            imageData[i * 4 + 2] = 255; // B
                            imageData[i * 4 + 3] = 255; // A (fully opaque)
                        }
                    }
                }
            }

            // --- 3. Draw the slice onto the canvas ---
            const imageBitmap = new ImageData(imageData, width, height);
            createImageBitmap(imageBitmap).then(bitmap => {
                ctx.drawImage(bitmap, screenX, screenY, screenWidth, screenHeight);
            });
        }
    }, [navigationState, frameBoundCellposeData, viewState, containerSize, frameCenter, frameSize, selectedNucleiIndices, getNucleusColor, isDataLoading, full3DMode, msInfo, cellposeOverlayOpacity]);

    return (
        <canvas
            ref={canvasRef}
            width={containerSize.width}
            height={containerSize.height}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none', // Allows mouse events to pass through to the viewer
                zIndex: 10, // Ensure it's on top of the Viv viewer
            }}
        />
    );
};