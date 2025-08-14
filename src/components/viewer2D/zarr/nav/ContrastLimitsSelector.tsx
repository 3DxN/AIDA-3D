'use client';

import React from 'react';

import type { ContrastLimitsProps } from '../../../../types/viewer2D/navProps';
import type { ChannelMapping, ContrastLimits } from '../../../../types/viewer2D/navTypes';


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
      <h3>Contrast Limits</h3>
      {Object.entries(channelMap).map(([role, channelIndex]) => {
        if (channelIndex === null || channelIndex === undefined) {
          return null;
        }

        const currentLimit = contrastLimits[channelIndex] ?? 0;
        const maxLimit = maxContrastLimit

        return (
          <div key={role} className="mb-4">
            <label className="block mb-1.5 font-bold">
              {role}: {currentLimit}
            </label>
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-gray-500 min-w-6">0</span>
              <input
                type="range"
                min={0}
                max={maxLimit}
                value={currentLimit}
                onChange={(e) => {
                  try {
                    const newLimit = parseInt(e.target.value, 10);
                    if (isNaN(newLimit)) {
                      return;
                    }
                    onContrastLimitsChange(
                      contrastLimits.map((limit, index) => 
                        index === channelIndex ? newLimit : limit
                      ) as ContrastLimits
                    );
                  } catch (error) {
                    console.error('Invalid contrast limit value:', e.target.value);
                    return;
                  }
                }}
                className="flex-1"
              />
              <span className="text-xs text-gray-500 min-w-8">{maxLimit}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ContrastLimitsSelector;