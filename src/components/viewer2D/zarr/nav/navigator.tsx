'use client'

import { useState } from 'react'

import type { NavigationControlsProps } from '../../../../types/viewer2D/navProps'
import Slider from './Slider'
import ChannelSelector from './ChannelSelector'
import ContrastLimitsSelector from './ContrastLimitsSelector'


export default function NavigationControls({
  msInfo,
  navigationState,
  navigationLimits,
  navigationHandlers
}: NavigationControlsProps) {
  const { zSlice, timeSlice, channelMap, contrastLimits } = navigationState
  const { maxZSlice, maxTimeSlice, maxContrastLimit } = navigationLimits
  const { onZSliceChange, onTimeSliceChange, onChannelChange, onContrastLimitsChange } = navigationHandlers
  
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div 
      className={`navigation-sidebar bg-gray-50 border-l border-gray-300 relative transition-all duration-300 ease-in-out flex-shrink-0 flex flex-col ${
        isCollapsed ? 'w-12' : 'w-80'
      }`}
    >
      {/* Collapse/Expand Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`absolute top-2.5 z-10 w-7 h-7 rounded-full border border-gray-300 bg-white cursor-pointer flex items-center justify-center text-sm font-bold text-gray-500 transition-all duration-300 ease-in-out shadow-sm hover:shadow-md ${
          isCollapsed ? 'left-2.5' : 'left-72'
        }`}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? '←' : '→'}
      </button>

      {/* Sidebar Content */}
      <div className={`overflow-hidden flex-1 pt-12 ${isCollapsed ? 'px-1 py-2.5' : 'p-4'}`}>
        {!isCollapsed && (
          <>
            <h4 className="m-0 mb-4 text-base font-bold">
              Navigation Controls
            </h4>

            <ChannelSelector
              channelNames={msInfo.channels}
              channelMap={channelMap}
              onChannelChange={onChannelChange}
            />

            <ContrastLimitsSelector
              contrastLimitsProps={{
                contrastLimits,
                maxContrastLimit,
                onContrastLimitsChange
              }}
              channelMap={channelMap}
            />

            {/* Current Coordinates Display */}
            <div className="mb-5">
              <label className="block mb-2 text-sm font-bold">
                Current View:
              </label>
              <div className="p-2.5 bg-gray-200 rounded text-xs font-mono">
                Disabled
                {/* <div className="mt-1 text-xs text-gray-500">
                  Total: {msInfo.shape[msInfo.shape.length - 1]} x {msInfo.shape[msInfo.shape.length - 2]}
                </div> */}
              </div>
            </div>

            {/* Navigation sliders */}
            <div className="grid gap-4 mb-1">
              <Slider
                label="Z Slice"
                value={zSlice}
                min={0}
                max={maxZSlice}
                onChange={onZSliceChange}
                condition={Boolean(msInfo.shape.z && maxZSlice > 1)}
              />

              <Slider
                label="Time"
                value={timeSlice}
                min={0}
                max={maxTimeSlice}
                onChange={onTimeSliceChange}
                condition={Boolean(msInfo.shape.t && maxTimeSlice > 1)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}