'use client';

import React from 'react';

import type { ContrastLimitsProps } from '../../../../types/viewer2D/navProps';
import type { ChannelMapping } from '../../../../types/viewer2D/navTypes';


/**
 * Navigator component that allows dynamic selection of contrast limits
 * per each selected channel defined in channelMap
 */
const ContrastLimitsSelector = ({
  contrastLimitsProps,
  channelMap,
}: {
  contrastLimitsProps: ContrastLimitsProps
  channelMap: ChannelMapping
}) => {
  const { contrastLimits, maxContrastLimit, onContrastLimitsChange } = contrastLimitsProps;

  return (
    <div>
      {Object.entries(channelMap).map(([role, channelIndex]) => {
        if (channelIndex === null || channelIndex === undefined) {
          return null;
        }

        const currentLimit = contrastLimits[channelIndex] ?? 0;
        const maxLimit = maxContrastLimit

        return (
          <div key={role} className="mb-3">
            <label className="block text-sm text-gray-700 mb-1">{role}</label>
            <input
              type="number"
              value={currentLimit}
              min={0}
              max={maxLimit}
              onChange={(e) => {
                const newLimit = parseInt(e.target.value) || 0;
                const newLimits = contrastLimits.map((limit, index) =>
                  index === channelIndex ? newLimit : limit
                ) as [number | null, number | null];
                onContrastLimitsChange(newLimits);
              }}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
        );
      })}
    </div>
  );
};

export default ContrastLimitsSelector;
