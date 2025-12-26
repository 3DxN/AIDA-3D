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

            // Use the data's inherent world position
            const worldOffset = (frameBoundCellposeData as any).worldOffset || [0, 0];
            const [screenX, screenY] = toScreen(worldOffset[0], worldOffset[1]);
            
            const labelScale = cellposeScales[selectedCellposeOverlayResolution] || [1, 1, 1];
            const screenWidth = width * labelScale[2] * scale;
            const screenHeight = height * labelScale[1] * scale;

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
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 10 }}
        />
    );
};
