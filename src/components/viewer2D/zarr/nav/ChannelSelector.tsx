import React from 'react';

import { ChannelMapperProps } from '../../../../types/viewer2D/navProps';
import { ChannelMapping } from '../../../../types/viewer2D/navTypes';


const ChannelSelector = (props: ChannelMapperProps) => {
  const { 
    channelNames,
    channelMap,
    onChannelChange: setChannelMapping
  } = props;

  // Handler for when a radio button is selected
  const handleDropdownChange = (role: keyof ChannelMapping, value: string) => {
    
    let selectedIndex: number | null;
    try {
      selectedIndex = parseInt(value, 10);
      if (isNaN(selectedIndex)) {
        selectedIndex = null; // If parsing fails, set to null
      }
    } catch (error) {
      selectedIndex = null;
    }

    setChannelMapping(role, selectedIndex);
  };

  return (
    <div className="mb-5 p-4 border border-gray-300 rounded bg-gray-50">
      <label className="block mb-2.5 text-sm font-bold">
        Channel Rendering Roles:
      </label>
      
      <div className="grid grid-cols-2 gap-5">
        {/* Nucleus Dropdown */}
        <div>
          <label className="block mb-1 text-xs font-medium">
            Nucleus
          </label>
          <select
            value={channelMap.nucleus === null ? 'null' : channelMap.nucleus}
            onChange={(e) => handleDropdownChange('nucleus', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-sm"
          >
            <option value="null">Select Channel</option>
            {channelNames.map((name, index) => (
              <option key={index} value={index}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Cytoplasm Dropdown */}
        <div>
          <label className="block mb-1 text-xs font-medium">
            Cytoplasm
          </label>
          <select
            value={channelMap.cytoplasm === null ? 'null' : channelMap.cytoplasm}
            onChange={(e) => handleDropdownChange('cytoplasm', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-sm"
          >
            <option value="null">Select Channel</option>
            {channelNames.map((name, index) => (
              <option key={index} value={index}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default ChannelSelector;