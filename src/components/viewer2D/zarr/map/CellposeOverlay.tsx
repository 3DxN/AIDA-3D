import React, { useEffect, useRef } from 'react';
import { useViewer2DData } from '../../../../lib/contexts/Viewer2DDataContext';
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
        isDataLoading
    } = useViewer2DData();
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

            // Top-left corner of the frame in world coordinates
            const frameWorldX = frameCenter[0] - frameSize[0] / 2;
            const frameWorldY = frameCenter[1] - frameSize[1] / 2;

            // Convert to screen coordinates
            const screenX = (frameWorldX - target[0]) * scale + containerSize.width / 2;
            const screenY = (frameWorldY - target[1]) * scale + containerSize.height / 2;
            const screenWidth = frameSize[0] * scale;
            const screenHeight = frameSize[1] * scale;

            // --- 2. Extract the 2D slice data (now a single Z layer from high-res overlay) ---
            const { data, shape } = frameBoundCellposeData;
            if (!shape || shape.length < 2) return;

            // Data is now 2D: [height, width] instead of 3D: [z, height, width]
            const height = shape[0];
            const width = shape[1];

            // Since we already fetched a single Z slice, use the data directly
            const sliceData = data;
            const imageData = new Uint8ClampedArray(width * height * 4);

            for (let i = 0; i < sliceData.length; i++) {
                const nucleusIndex = sliceData[i];
                const isNucleus = nucleusIndex > 0;
                const isSelected = selectedNucleiIndices.includes(nucleusIndex);

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
                        imageData[i * 4 + 3] = isSelected ? 255 : 178; // A (100% if selected, 70% if not)
                    } else {
                        // Fallback to original colors if no 3D color available
                        if (isSelected) {
                            imageData[i * 4] = 255;     // R (Yellow)
                            imageData[i * 4 + 1] = 255; // G
                            imageData[i * 4 + 2] = 0;   // B
                            imageData[i * 4 + 3] = 255; // A (100% opacity)
                        } else {
                            imageData[i * 4] = 0;       // R (Black)
                            imageData[i * 4 + 1] = 0;   // G
                            imageData[i * 4 + 2] = 0;   // B
                            imageData[i * 4 + 3] = 178; // A (70% opacity)
                        }
                    }
                } else {
                    imageData[i * 4 + 3] = 0; // Transparent
                }
            }

            // --- 3. Draw the slice onto the canvas ---
            const imageBitmap = new ImageData(imageData, width, height);
            createImageBitmap(imageBitmap).then(bitmap => {
                ctx.drawImage(bitmap, screenX, screenY, screenWidth, screenHeight);
            });
        }
    }, [navigationState, frameBoundCellposeData, viewState, containerSize, frameCenter, frameSize, selectedNucleiIndices, getNucleusColor, isDataLoading]);

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