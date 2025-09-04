'use client';

import React from 'react';
import UnifiedSlider from '../../../interaction/UnifiedSlider';

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
            <UnifiedSlider
              label={role}
              value={currentLimit}
              minValue={0}
              maxValue={maxLimit}
              onChange={(newValue) => {
                const newLimit = Array.isArray(newValue) ? newValue[0] : newValue;
                const newLimits = contrastLimits.map((limit, index) =>
                  index === channelIndex ? newLimit : limit
                ) as [number | null, number | null];
                onContrastLimitsChange(newLimits);
              }}
              valueDisplay={`${currentLimit}/${maxLimit}`}
            />
          </div>
        );
      })}
    </div>
  );
};

export default ContrastLimitsSelector;
