import React, { useEffect, useRef } from 'react';
import { useViewer2DData } from '../../../../lib/contexts/Viewer2DDataContext';
import { useNucleusSelection } from '../../../../lib/contexts/NucleusSelectionContext';
import { useNucleusColor } from '../../../../lib/contexts/NucleusColorContext';
import { useZarrStore } from '../../../../lib/contexts/ZarrStoreContext';
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
        frameCenter,
        frameSize,
        isDataLoading
    } = useViewer2DData();
    const { selectedNucleiIndices } = useNucleusSelection();
    const { getNucleusColor } = useNucleusColor();
    const { cellposeScales, selectedCellposeOverlayResolution } = useZarrStore();

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas || !viewState) return;

        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (navigationState.cellposeOverlayOn && frameBoundCellposeData && !isDataLoading) {
            const { data, shape } = frameBoundCellposeData;
            const height = shape[0];
            const width = shape[1];
            if (width <= 0 || height <= 0) return;

            // Simple Screen Projection
            const { target, zoom } = viewState;
            const scale = Math.pow(2, zoom);
            const toScreen = (worldX: number, worldY: number): [number, number] => {
                const sx = (worldX - target[0]) * scale + containerSize.width / 2;
                const sy = (worldY - target[1]) * scale + containerSize.height / 2;
                return [sx, sy];
            };

            // FORCE DRAW AT FRAME CENTER (Align with red box)
            const frameWorldX = frameCenter[0] - frameSize[0] / 2;
            const frameWorldY = frameCenter[1] - frameSize[1] / 2;
            
            const [screenX, screenY] = toScreen(frameWorldX, frameWorldY);
            const screenWidth = frameSize[0] * scale;
            const screenHeight = frameSize[1] * scale;

            // SAFETY CHECK: Ensure fetch data matches dimensions
            if (data.length !== width * height) {
                console.warn(`🎨 [2D Overlay] Buffer mismatch! Expected ${width * height}, got ${data.length}. Skipping frame.`);
                return;
            }

            console.log(`🎨 [2D Overlay] Drawing set: ${width}x${height} at screen [${Math.round(screenX)}, ${Math.round(screenY)}]`);

            const imageData = new Uint8ClampedArray(width * height * 4);
            for (let i = 0; i < data.length; i++) {
                const id = data[i];
                if (id > 0) {
                    const isSelected = selectedNucleiIndices.includes(id);
                    const color = getNucleusColor(id);
                    if (color) {
                        imageData[i * 4] = Math.floor(color.r * 255);
                        imageData[i * 4 + 1] = Math.floor(color.g * 255);
                        imageData[i * 4 + 2] = Math.floor(color.b * 255);
                        imageData[i * 4 + 3] = isSelected ? 255 : 178;
                    } else {
                        // High-visibility Teal for new brain segments
                        imageData[i * 4] = 45; imageData[i * 4 + 1] = 212; imageData[i * 4 + 2] = 191;
                        imageData[i * 4 + 3] = isSelected ? 255 : 140;
                    }
                }
            }

            createImageBitmap(new ImageData(imageData, width, height)).then(bitmap => {
                ctx.drawImage(bitmap, screenX, screenY, screenWidth, screenHeight);
            });
        }
    }, [navigationState.cellposeOverlayOn, frameBoundCellposeData, viewState, containerSize, selectedNucleiIndices, getNucleusColor, isDataLoading, cellposeScales, selectedCellposeOverlayResolution]);

    return (
        <canvas ref={canvasRef} width={containerSize.width} height={containerSize.height}
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 100 }}
        />
    );
};
