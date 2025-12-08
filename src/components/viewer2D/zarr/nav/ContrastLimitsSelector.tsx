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

        const currentLimits = contrastLimits[channelIndex] ?? [0, 0];
        const [lowerLimit, upperLimit] = currentLimits;
        const maxLimit = maxContrastLimit;

        return (
          <div key={role} className="mb-3">
            <label className="block text-sm text-gray-700 mb-1">{role}</label>
            <div className="flex space-x-2">
              <div className="flex-1">
                <input
                  type="number"
                  value={lowerLimit}
                  min={0}
                  max={upperLimit}
                  onChange={(e) => {
                    const newLower = parseInt(e.target.value) || 0;
                    const newLimits = contrastLimits.map((limit, index) =>
                      index === channelIndex ? [newLower, upperLimit] : limit
                    ) as [[number, number] | null, [number, number] | null];
                    onContrastLimitsChange(newLimits);
                  }}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Lower"
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  value={upperLimit}
                  min={lowerLimit}
                  max={maxLimit}
                  onChange={(e) => {
                    const newUpper = parseInt(e.target.value) || 0;
                    const newLimits = contrastLimits.map((limit, index) =>
                      index === channelIndex ? [lowerLimit, newUpper] : limit
                    ) as [[number, number] | null, [number, number] | null];
                    onContrastLimitsChange(newLimits);
                  }}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Upper"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ContrastLimitsSelector;
