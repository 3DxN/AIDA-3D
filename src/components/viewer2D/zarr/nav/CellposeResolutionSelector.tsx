import React from 'react';
import { useZarrStore } from '../../../../lib/contexts/ZarrStoreContext';

const CellposeResolutionSelector: React.FC = () => {
  const {
    cellposeResolutions,
    selectedCellposeResolution,
    setSelectedCellposeResolution,
    cellposeArray
  } = useZarrStore();

  // Don't render if no cellpose data or only one resolution
  if (!cellposeArray || cellposeResolutions.length <= 1) {
    return null;
  }

  const handleResolutionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const index = parseInt(e.target.value, 10);
    if (!isNaN(index)) {
      setSelectedCellposeResolution(index);
    }
  };

  return (
    <div className="px-4 py-2 border-b border-gray-200">
      <label className="block mb-1 text-xs font-medium text-gray-700">
        Cellpose Resolution
      </label>
      <select
        value={selectedCellposeResolution}
        onChange={handleResolutionChange}
        className="w-full p-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        {cellposeResolutions.map((resolution, index) => (
          <option key={index} value={index}>
            Level {index} ({resolution})
          </option>
        ))}
      </select>
    </div>
  );
};

export default CellposeResolutionSelector;
