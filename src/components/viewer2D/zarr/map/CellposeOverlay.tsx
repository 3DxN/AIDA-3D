import React, { useEffect, useRef } from 'react';
import { useViewer2DData } from '../../../../lib/contexts/Viewer2DDataContext';
import { useNucleusSelection } from '../../../../lib/contexts/NucleusSelectionContext';
import { useNucleusColor } from '../../../../lib/contexts/NucleusColorContext';
import { useROI } from '../../../../lib/contexts/ROIContext';
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
    const { selectedROI } = useROI();

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

            const toScreen = (worldX: number, worldY: number): [number, number] => {
                const sx = (worldX - target[0]) * scale + containerSize.width / 2;
                const sy = (worldY - target[1]) * scale + containerSize.height / 2;
                return [sx, sy];
            };

            // Top-left corner of the frame in world coordinates
            const frameWorldX = frameCenter[0] - frameSize[0] / 2;
            const frameWorldY = frameCenter[1] - frameSize[1] / 2;

            const [screenX, screenY] = toScreen(frameWorldX, frameWorldY);
            const screenWidth = frameSize[0] * scale;
            const screenHeight = frameSize[1] * scale;

            // --- 2. Extract the 2D slice data ---
            const { data, shape } = frameBoundCellposeData;
            if (!shape || shape.length < 2) return;

            const height = shape[0];
            const width = shape[1];

            const sliceData = data;
            const imageData = new Uint8ClampedArray(width * height * 4);

            for (let i = 0; i < sliceData.length; i++) {
                const nucleusIndex = sliceData[i];
                const isNucleus = nucleusIndex > 0;
                const isSelected = selectedNucleiIndices.includes(nucleusIndex);

                if (isNucleus) {
                    const threeDColor = getNucleusColor(nucleusIndex);
                    if (threeDColor) {
                        const r = Math.floor(threeDColor.r * 255);
                        const g = Math.floor(threeDColor.g * 255);
                        const b = Math.floor(threeDColor.b * 255);
                        imageData[i * 4] = r;
                        imageData[i * 4 + 1] = g;
                        imageData[i * 4 + 2] = b;
                        imageData[i * 4 + 3] = isSelected ? 255 : 178;
                    } else {
                        if (isSelected) {
                            imageData[i * 4] = 255;
                            imageData[i * 4 + 1] = 255;
                            imageData[i * 4 + 2] = 0;
                            imageData[i * 4 + 3] = 255;
                        } else {
                            imageData[i * 4] = 0;
                            imageData[i * 4 + 1] = 0;
                            imageData[i * 4 + 2] = 0;
                            imageData[i * 4 + 3] = 178;
                        }
                    }
                } else {
                    imageData[i * 4 + 3] = 0;
                }
            }

            // --- 3. Draw the slice onto the canvas ---
            const imageBitmap = new ImageData(imageData, width, height);
            createImageBitmap(imageBitmap).then(bitmap => {
                ctx.save();
                if (selectedROI && selectedROI.points.length >= 3 && 
                    zSlice >= selectedROI.zRange[0] && 
                    zSlice <= selectedROI.zRange[1]) {
                    const screenPoints = selectedROI.points.map(p => toScreen(p[0], p[1]));
                    ctx.beginPath();
                    ctx.moveTo(screenPoints[0][0], screenPoints[0][1]);
                    for (let i = 1; i < screenPoints.length; i++) {
                        ctx.lineTo(screenPoints[i][0], screenPoints[i][1]);
                    }
                    ctx.closePath();
                    ctx.clip();
                }
                ctx.drawImage(bitmap, screenX, screenY, screenWidth, screenHeight);
                ctx.restore();
            });
        }
    }, [navigationState, frameBoundCellposeData, viewState, containerSize, frameCenter, frameSize, selectedNucleiIndices, getNucleusColor, isDataLoading, selectedROI]);

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