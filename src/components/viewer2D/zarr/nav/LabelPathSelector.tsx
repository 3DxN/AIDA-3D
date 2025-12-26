'use client';

import React from 'react';
import { useZarrStore } from '../../../../lib/contexts/ZarrStoreContext';

const LabelPathSelector = () => {
  const { availableCellposePaths, cellposePath, setSelectedCellposePath, isCellposeLoading } = useZarrStore();

  if (!availableCellposePaths || availableCellposePaths.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-2 border-b border-gray-100">
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
        Active Label Set
      </label>
      <div className="relative">
        <select
          value={cellposePath}
          onChange={(e) => setSelectedCellposePath(e.target.value)}
          disabled={isCellposeLoading}
          className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-md focus:ring-teal-500 focus:border-teal-500 block p-1.5 pr-8 appearance-none cursor-pointer disabled:opacity-50"
        >
          {availableCellposePaths.map((path) => (
            <option key={path} value={path}>
              {path.replace(/(\.\.\/)+/, '').replace(/^labels\//, '')}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
          <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
      {isCellposeLoading && (
        <div className="mt-1 text-[10px] text-teal-600 animate-pulse font-medium">
          🔄 Loading labels...
        </div>
      )}
    </div>
  );
};

export default LabelPathSelector;
