'use client'

import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/solid'
import { Disclosure } from '@headlessui/react'
import { useViewer2DData } from '../../../../lib/contexts/Viewer2DDataContext'
import { useZarrStore } from '../../../../lib/contexts/ZarrStoreContext'

import UnifiedSlider from '../../../interaction/UnifiedSlider'
import ChannelSelector from './ChannelSelector'
import ContrastLimitsSelector from './ContrastLimitsSelector'

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}


export default function NavigationControls() {
  // Get all data from contexts instead of props
  const { msInfo } = useZarrStore()
  const { 
    navigationState, 
    setNavigationState,
    frameCenter,
    frameSize,
    frameZDepth,
    setFrameCenter,
    setFrameSize,
    setFrameZDepth,
    getFrameBounds
  } = useViewer2DData()

  if (!msInfo || !navigationState) {
    return null
  }

  const { zSlice, timeSlice, channelMap, contrastLimits } = navigationState
  
  // Calculate navigation limits from msInfo
  const maxZSlice = msInfo.shape.z ? msInfo.shape.z - 1 : 0
  const maxTimeSlice = msInfo.shape.t ? msInfo.shape.t - 1 : 0
  const maxContrastLimit = msInfo.dtype === 'uint8' ? 255 : msInfo.dtype === 'uint16' ? 65535 : 1024

  // Create navigation handlers that update context state
  const navigationHandlers = {
    onZSliceChange: (value: number) => setNavigationState({ ...navigationState, zSlice: value }),
    onTimeSliceChange: (value: number) => setNavigationState({ ...navigationState, timeSlice: value }),
    onChannelChange: (role: keyof typeof channelMap, value: number | null) => setNavigationState({
      ...navigationState,
      channelMap: { ...navigationState.channelMap, [role]: value }
    }),
    onContrastLimitsChange: (limits: [number | null, number | null]) => setNavigationState({
      ...navigationState, 
      contrastLimits: limits
    })
  }
  
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <>
      {/* Open button */}
      {!isCollapsed && (
        <button
          onClick={() => setIsCollapsed(true)}
          className="rounded-bl-md hover:bg-gray-100 border-gray-200 shadow p-2 bg-white absolute top-0 right-0 inline-flex items-center text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 z-10"
        >
          <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
          Controls
        </button>
      )}

      {/* Content */}
      {isCollapsed && (
        <div className="bg-white border-l border-gray-200 h-screen shadow text-gray-800 flex flex-col divide-y w-80 absolute right-0 top-0 z-10">
          {/* Close button */}
          <button
            onClick={() => setIsCollapsed(false)}
            className="w-full flex justify-between hover:bg-gray-100 p-2 items-center focus:outline-none ring-inset focus:ring-2 focus:ring-teal-500"
          >
            Navigation Controls
            <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Navigation Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Channel Selection */}
            <Disclosure className="shadow-sm" as="div" defaultOpen>
              {({ open }) => (
                <>
                  <Disclosure.Button
                    className={classNames(
                      'text-gray-700 hover:bg-gray-50 hover:text-gray-900 bg-white group w-full flex items-center pr-2 py-2 text-left text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 relative z-10 ring-inset'
                    )}
                  >
                    <svg
                      className={classNames(
                        open ? 'text-gray-400 rotate-90' : 'text-gray-300',
                        'mr-2 shrink-0 h-5 w-5 group-hover:text-gray-400 transition-colors ease-in-out duration-150'
                      )}
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M6 6L14 10L6 14V6Z" fill="currentColor" />
                    </svg>
                    Channels
                  </Disclosure.Button>
                  <Disclosure.Panel className="relative w-full px-4 py-2">
                    <ChannelSelector
                      channelNames={msInfo.channels}
                      channelMap={channelMap}
                      onChannelChange={navigationHandlers.onChannelChange}
                    />
                  </Disclosure.Panel>
                </>
              )}
            </Disclosure>

            {/* Contrast Limits */}
            <Disclosure className="shadow-sm" as="div" defaultOpen>
              {({ open }) => (
                <>
                  <Disclosure.Button
                    className={classNames(
                      'text-gray-700 hover:bg-gray-50 hover:text-gray-900 bg-white group w-full flex items-center pr-2 py-2 text-left text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 relative z-10 ring-inset'
                    )}
                  >
                    <svg
                      className={classNames(
                        open ? 'text-gray-400 rotate-90' : 'text-gray-300',
                        'mr-2 shrink-0 h-5 w-5 group-hover:text-gray-400 transition-colors ease-in-out duration-150'
                      )}
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M6 6L14 10L6 14V6Z" fill="currentColor" />
                    </svg>
                    Contrast
                  </Disclosure.Button>
                  <Disclosure.Panel className="relative w-full px-4 py-2">
                    <ContrastLimitsSelector
                      contrastLimitsProps={{
                        contrastLimits,
                        maxContrastLimit,
                        onContrastLimitsChange: navigationHandlers.onContrastLimitsChange
                      }}
                      channelMap={channelMap}
                    />
                  </Disclosure.Panel>
                </>
              )}
            </Disclosure>

            {/* Frame Selection */}
            <Disclosure className="shadow-sm" as="div">
              {({ open }) => (
                <>
                  <Disclosure.Button
                    className={classNames(
                      'text-gray-700 hover:bg-gray-50 hover:text-gray-900 bg-white group w-full flex items-center pr-2 py-2 text-left text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 relative z-10 ring-inset'
                    )}
                  >
                    <svg
                      className={classNames(
                        open ? 'text-gray-400 rotate-90' : 'text-gray-300',
                        'mr-2 shrink-0 h-5 w-5 group-hover:text-gray-400 transition-colors ease-in-out duration-150'
                      )}
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M6 6L14 10L6 14V6Z" fill="currentColor" />
                    </svg>
                    Frame Selection
                  </Disclosure.Button>
                  <Disclosure.Panel className="relative w-full px-4 py-2">
                    {/* Frame Center */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Frame Center (X, Y):
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={Math.round(frameCenter[0])}
                          onChange={(e) => setFrameCenter([parseInt(e.target.value) || 0, frameCenter[1]])}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          placeholder="X"
                        />
                        <input
                          type="number"
                          value={Math.round(frameCenter[1])}
                          onChange={(e) => setFrameCenter([frameCenter[0], parseInt(e.target.value) || 0])}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          placeholder="Y"
                        />
                      </div>
                    </div>

                    {/* Frame Size */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Frame Size (W × H):
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={Math.round(frameSize[0])}
                          onChange={(e) => setFrameSize([parseInt(e.target.value) || 100, frameSize[1]])}
                          min="50"
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          placeholder="Width"
                        />
                        <input
                          type="number"
                          value={Math.round(frameSize[1])}
                          onChange={(e) => setFrameSize([frameSize[0], parseInt(e.target.value) || 100])}
                          min="50"
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          placeholder="Height"
                        />
                      </div>
                    </div>

                    {/* Z Depth Control */}
                    {msInfo.shape.z && msInfo.shape.z > 1 && (
                      <div className="mb-3">
                        <UnifiedSlider
                          label="Z Depth Range"
                          value={frameZDepth}
                          minValue={0}
                          maxValue={Math.floor((msInfo.shape.z - 1) / 2)}
                          onChange={(value) => setFrameZDepth(Array.isArray(value) ? value[0] : value)}
                          valueDisplay={(val) => {
                            const depth = Array.isArray(val) ? val[0] : val;
                            const maxZ = msInfo.shape.z || 1;
                            return `±${depth} slices (Z ${Math.max(0, zSlice - depth)} - ${Math.min(maxZ - 1, zSlice + depth)})`;
                          }}
                        />
                      </div>
                    )}

                    {/* Frame Bounds Info */}
                    {(() => {
                      const bounds = getFrameBounds()
                      return (
                        <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-md border">
                          <div className="font-medium mb-2">Frame Bounds:</div>
                          <div className="space-y-1">
                            <div>Left: {bounds.left.toFixed(0)}, Right: {bounds.right.toFixed(0)}</div>
                            <div>Top: {bounds.top.toFixed(0)}, Bottom: {bounds.bottom.toFixed(0)}</div>
                            <div>Area: {((bounds.right - bounds.left) * (bounds.bottom - bounds.top)).toFixed(0)} px²</div>
                          </div>
                        </div>
                      )
                    })()}
                  </Disclosure.Panel>
                </>
              )}
            </Disclosure>

            {/* Navigation */}
            <Disclosure className="shadow-sm" as="div" defaultOpen>
              {({ open }) => (
                <>
                  <Disclosure.Button
                    className={classNames(
                      'text-gray-700 hover:bg-gray-50 hover:text-gray-900 bg-white group w-full flex items-center pr-2 py-2 text-left text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 relative z-10 ring-inset'
                    )}
                  >
                    <svg
                      className={classNames(
                        open ? 'text-gray-400 rotate-90' : 'text-gray-300',
                        'mr-2 shrink-0 h-5 w-5 group-hover:text-gray-400 transition-colors ease-in-out duration-150'
                      )}
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M6 6L14 10L6 14V6Z" fill="currentColor" />
                    </svg>
                    Navigation
                  </Disclosure.Button>
                  <Disclosure.Panel className="relative w-full px-4 py-2">
                    <div className="space-y-3">
                      <UnifiedSlider
                        label="Z Slice"
                        value={zSlice}
                        minValue={0}
                        maxValue={maxZSlice}
                        onChange={(value) => navigationHandlers.onZSliceChange(Array.isArray(value) ? value[0] : value)}
                        condition={Boolean(msInfo.shape.z && maxZSlice > 1)}
                      />

                      <UnifiedSlider
                        label="Time"
                        value={timeSlice}
                        minValue={0}
                        maxValue={maxTimeSlice}
                        onChange={(value) => navigationHandlers.onTimeSliceChange(Array.isArray(value) ? value[0] : value)}
                        condition={Boolean(msInfo.shape.t && maxTimeSlice > 1)}
                      />
                    </div>
                  </Disclosure.Panel>
                </>
              )}
            </Disclosure>
          </div>
        </div>
      )}
    </>
  )
}