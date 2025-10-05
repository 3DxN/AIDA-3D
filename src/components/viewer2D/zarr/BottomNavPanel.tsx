'use client'

import { useState } from 'react'
import { useViewer2DData } from '../../../lib/contexts/Viewer2DDataContext'
import { useZarrStore } from '../../../lib/contexts/ZarrStoreContext'
import UnifiedSlider from '../../interaction/UnifiedSlider'

export default function BottomNavPanel() {
  const { msInfo } = useZarrStore()
  const {
    navigationState,
    setNavigationState,
    frameCenter,
    frameSize,
    frameZLayersAbove,
    frameZLayersBelow,
    setFrameCenter,
    setFrameSize,
    setFrameZLayersAbove,
    setFrameZLayersBelow,
    getFrameBounds
  } = useViewer2DData()

  const [tempFrameZLayersAbove, setTempFrameZLayersAbove] = useState<number | null>(null)
  const [tempFrameZLayersBelow, setTempFrameZLayersBelow] = useState<number | null>(null)
  const [tempZSlice, setTempZSlice] = useState<number | null>(null)
  const [tempTimeSlice, setTempTimeSlice] = useState<number | null>(null)

  if (!msInfo || !navigationState) {
    return null
  }

  const { zSlice, timeSlice } = navigationState

  const maxZSlice = msInfo.shape.z ? msInfo.shape.z - 1 : 0
  const maxTimeSlice = msInfo.shape.t ? msInfo.shape.t - 1 : 0

  const navigationHandlers = {
    onZSliceChange: (value: number) => setNavigationState({ ...navigationState, zSlice: value }),
    onTimeSliceChange: (value: number) => setNavigationState({ ...navigationState, timeSlice: value }),
  }

  const bounds = getFrameBounds()

  return (
    <div className="bg-white border-t border-gray-200 p-3">
      <div className="grid grid-cols-2 gap-4 max-w-7xl mx-auto">
        {/* Frame Controls */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-700 mb-2">Frame</div>

          <div>
            <div className="text-xs font-medium text-gray-700 mb-1">Center (X, Y)</div>
            <div className="flex space-x-2">
              <input
                type="number"
                value={Math.round(frameCenter[0])}
                onChange={(e) => setFrameCenter([parseInt(e.target.value) || 0, frameCenter[1]])}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="X"
              />
              <input
                type="number"
                value={Math.round(frameCenter[1])}
                onChange={(e) => setFrameCenter([frameCenter[0], parseInt(e.target.value) || 0])}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="Y"
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-700 mb-1">Size (W × H)</div>
            <div className="flex space-x-2">
              <input
                type="number"
                value={Math.round(frameSize[0])}
                onChange={(e) => setFrameSize([parseInt(e.target.value) || 100, frameSize[1]])}
                min="50"
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="W"
              />
              <input
                type="number"
                value={Math.round(frameSize[1])}
                onChange={(e) => setFrameSize([frameSize[0], parseInt(e.target.value) || 100])}
                min="50"
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="H"
              />
            </div>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-700 mb-2">Navigation</div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Current Z layer</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={tempZSlice ?? zSlice}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    const clamped = Math.max(0, Math.min(maxZSlice, val));
                    setTempZSlice(clamped);
                  }}
                  onBlur={() => {
                    if (tempZSlice !== null) {
                      navigationHandlers.onZSliceChange(tempZSlice);
                      setTempZSlice(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tempZSlice !== null) {
                      navigationHandlers.onZSliceChange(tempZSlice);
                      setTempZSlice(null);
                    }
                  }}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  min={0}
                  max={maxZSlice}
                />
                <span className="text-sm text-gray-600">/ {maxZSlice}</span>
              </div>
            </div>
            <UnifiedSlider
              value={tempZSlice ?? zSlice}
              minValue={0}
              maxValue={maxZSlice}
              onChange={(value) => setTempZSlice(Array.isArray(value) ? value[0] : value)}
              onChangeCommitted={(value) => {
                navigationHandlers.onZSliceChange(Array.isArray(value) ? value[0] : value);
                setTempZSlice(null);
              }}
              condition={Boolean(msInfo.shape.z && maxZSlice > 0)}
            />
          </div>

          {msInfo.shape.z && msInfo.shape.z > 1 && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Layers Above</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={tempFrameZLayersAbove ?? frameZLayersAbove}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        const clamped = Math.max(0, Math.min(msInfo.shape.z - 1 - zSlice, val));
                        setTempFrameZLayersAbove(clamped);
                      }}
                      onBlur={() => {
                        if (tempFrameZLayersAbove !== null) {
                          setFrameZLayersAbove(tempFrameZLayersAbove);
                          setTempFrameZLayersAbove(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && tempFrameZLayersAbove !== null) {
                          setFrameZLayersAbove(tempFrameZLayersAbove);
                          setTempFrameZLayersAbove(null);
                        }
                      }}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      min={0}
                      max={msInfo.shape.z - 1 - zSlice}
                    />
                    <span className="text-sm text-gray-600">
                      (up to Z {Math.min(msInfo.shape.z - 1, zSlice + (tempFrameZLayersAbove ?? frameZLayersAbove))})
                    </span>
                  </div>
                </div>
                <UnifiedSlider
                  value={tempFrameZLayersAbove ?? frameZLayersAbove}
                  minValue={0}
                  maxValue={msInfo.shape.z - 1 - zSlice}
                  onChange={(value) => setTempFrameZLayersAbove(Array.isArray(value) ? value[0] : value)}
                  onChangeCommitted={(value) => {
                    setFrameZLayersAbove(Array.isArray(value) ? value[0] : value);
                    setTempFrameZLayersAbove(null);
                  }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Layers Below</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={tempFrameZLayersBelow ?? frameZLayersBelow}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        const clamped = Math.max(0, Math.min(zSlice, val));
                        setTempFrameZLayersBelow(clamped);
                      }}
                      onBlur={() => {
                        if (tempFrameZLayersBelow !== null) {
                          setFrameZLayersBelow(tempFrameZLayersBelow);
                          setTempFrameZLayersBelow(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && tempFrameZLayersBelow !== null) {
                          setFrameZLayersBelow(tempFrameZLayersBelow);
                          setTempFrameZLayersBelow(null);
                        }
                      }}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      min={0}
                      max={zSlice}
                    />
                    <span className="text-sm text-gray-600">
                      (down to Z {Math.max(0, zSlice - (tempFrameZLayersBelow ?? frameZLayersBelow))})
                    </span>
                  </div>
                </div>
                <UnifiedSlider
                  value={tempFrameZLayersBelow ?? frameZLayersBelow}
                  minValue={0}
                  maxValue={zSlice}
                  onChange={(value) => setTempFrameZLayersBelow(Array.isArray(value) ? value[0] : value)}
                  onChangeCommitted={(value) => {
                    setFrameZLayersBelow(Array.isArray(value) ? value[0] : value);
                    setTempFrameZLayersBelow(null);
                  }}
                />
              </div>
            </>
          )}

          <UnifiedSlider
            label="Time"
            value={tempTimeSlice ?? timeSlice}
            minValue={0}
            maxValue={maxTimeSlice}
            onChange={(value) => setTempTimeSlice(Array.isArray(value) ? value[0] : value)}
            onChangeCommitted={(value) => {
              navigationHandlers.onTimeSliceChange(Array.isArray(value) ? value[0] : value);
              setTempTimeSlice(null);
            }}
            condition={Boolean(msInfo.shape.t && maxTimeSlice > 0)}
          />
        </div>
      </div>
    </div>
  )
}
