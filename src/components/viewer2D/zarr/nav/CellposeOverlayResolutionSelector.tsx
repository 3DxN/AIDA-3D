import React from 'react';
import { useZarrStore } from '../../../../lib/contexts/ZarrStoreContext';

const CellposeOverlayResolutionSelector: React.FC = () => {
  const {
    cellposeResolutions,
    selectedCellposeOverlayResolution,
    setSelectedCellposeOverlayResolution,
    cellposeArrays
  } = useZarrStore();

  // Don't render if no cellpose data or only one resolution
  if (!cellposeArrays || cellposeArrays.length === 0 || cellposeResolutions.length <= 1) {
    return null;
  }

  const handleResolutionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const index = parseInt(e.target.value, 10);
    if (!isNaN(index)) {
      setSelectedCellposeOverlayResolution(index);
    }
  };

  return (
    <div className="px-4 py-2 border-b border-gray-200">
      <label className="block mb-1 text-xs font-medium text-gray-700">
        2D Overlay Resolution
      </label>
      <select
        value={selectedCellposeOverlayResolution}
        onChange={handleResolutionChange}
        className="w-full p-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        {cellposeResolutions.map((resolution, index) => (
          <option key={index} value={index}>
            Level {index} ({resolution})
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-500">
        High-res single Z layer for overlay
      </p>
    </div>
  );
};

export default CellposeOverlayResolutionSelector;
