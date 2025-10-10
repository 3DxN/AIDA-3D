'use client'

import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/solid'
import { useViewer2DData } from '../../../../lib/contexts/Viewer2DDataContext'
import { useZarrStore } from '../../../../lib/contexts/ZarrStoreContext'

import UnifiedSlider from '../../../interaction/UnifiedSlider'
import Switch from '../../../interaction/Switch'
import ChannelSelector from './ChannelSelector'
import ContrastLimitsSelector from './ContrastLimitsSelector'
import CellposeOverlayResolutionSelector from './CellposeOverlayResolutionSelector'
import CellposeMeshResolutionSelector from './CellposeMeshResolutionSelector'

export default function NavigationControls({ onToggle }: { onToggle?: (open: boolean) => void }) {
    // Get all data from contexts instead of props
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

    const [isCollapsed, setIsCollapsed] = useState(true)

    // Temporary state for frame parameters during slider dragging (to avoid cellpose context updates)
    const [tempFrameZLayersAbove, setTempFrameZLayersAbove] = useState<number | null>(null)
    const [tempFrameZLayersBelow, setTempFrameZLayersBelow] = useState<number | null>(null)
    const [tempZSlice, setTempZSlice] = useState<number | null>(null)
    const [tempTimeSlice, setTempTimeSlice] = useState<number | null>(null)

    const handleToggle = (newState: boolean) => {
        setIsCollapsed(newState)
        onToggle?.(newState)
    }

    if (!msInfo || !navigationState) {
        return null
    }

    const { zSlice, timeSlice, channelMap, contrastLimits, cellposeOverlayOn } = navigationState

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
        }),
        onCellposeOverlayToggle: (newState: boolean) => setNavigationState({
            ...navigationState,
            cellposeOverlayOn: newState
        }),
    }

    return (
        <>
            {/* Open button */}
            {!isCollapsed && (
                <button
                    onClick={() => handleToggle(true)}
                    className="rounded-bl-md hover:bg-gray-100 border-gray-200 shadow p-2 bg-white absolute top-0 right-0 inline-flex items-center text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 z-10"
                >
                    <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                    Controls
                </button>
            )}

            {/* Content */}
            {isCollapsed && (
                <div className="bg-white border-l border-gray-200 h-screen shadow text-gray-800 flex flex-col divide-y w-48 absolute right-0 top-0 z-10">
                    {/* Close button */}
                    <button
                        onClick={() => handleToggle(false)}
                        className="w-full flex justify-between hover:bg-gray-100 p-2 items-center focus:outline-none ring-inset focus:ring-2 focus:ring-teal-500"
                    >
                        Navigation Controls
                        <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                    </button>

                    {/* Navigation Content */}
                    <div className="flex-1">
                        {/* Overlays */}
                        <div className="px-4 py-2 border-b border-gray-200">
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Overlays</h3>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-800">Cellpose Nuclei</span>
                                <Switch
                                    enabled={cellposeOverlayOn}
                                    onChange={navigationHandlers.onCellposeOverlayToggle}
                                />
                            </div>
                        </div>

                        {/* Cellpose Resolution Selectors */}
                        <CellposeOverlayResolutionSelector />
                        <CellposeMeshResolutionSelector />

                        {/* Channel Selection */}
                        <div className="px-4 py-2 border-b border-gray-200">
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Channels</h3>
                            <ChannelSelector
                                channelNames={msInfo.channels}
                                channelMap={channelMap}
                                onChannelChange={navigationHandlers.onChannelChange}
                            />
                        </div>

                        {/* Contrast Limits */}
                        <div className="px-4 py-2 border-b border-gray-200">
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Contrast</h3>
                            <ContrastLimitsSelector
                                contrastLimitsProps={{
                                    contrastLimits,
                                    maxContrastLimit,
                                    onContrastLimitsChange: navigationHandlers.onContrastLimitsChange
                                }}
                                channelMap={channelMap}
                            />
                        </div>

                        {/* Frame Selection and Navigation - Side by Side */}
                        <div className="px-4 py-2 border-b border-gray-200">
                            <div className="grid grid-cols-2 gap-4">
                                {/* Frame Selection - Left Side */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3">Frame</h3>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="text-xs font-medium text-gray-700 mb-2">Center (X, Y)</div>
                                            <div className="flex space-x-2">
                                                <input
                                                    type="number"
                                                    value={Math.round(frameCenter[0])}
                                                    onChange={(e) => setFrameCenter([parseInt(e.target.value) || 0, frameCenter[1]])}
                                                    className="w-16 px-1 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                    placeholder="X"
                                                />
                                                <input
                                                    type="number"
                                                    value={Math.round(frameCenter[1])}
                                                    onChange={(e) => setFrameCenter([frameCenter[0], parseInt(e.target.value) || 0])}
                                                    className="w-16 px-1 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                    placeholder="Y"
                                                />
                                            </div>
                                        </div>

                                        {/* Frame Size Control */}
                                        <div>
                                            <div className="text-xs font-medium text-gray-700 mb-2">Size (W × H)</div>
                                            <div className="flex space-x-2">
                                                <input
                                                    type="number"
                                                    value={Math.round(frameSize[0])}
                                                    onChange={(e) => setFrameSize([parseInt(e.target.value) || 100, frameSize[1]])}
                                                    min="50"
                                                    className="w-16 px-1 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                    placeholder="W"
                                                />
                                                <input
                                                    type="number"
                                                    value={Math.round(frameSize[1])}
                                                    onChange={(e) => setFrameSize([frameSize[0], parseInt(e.target.value) || 100])}
                                                    min="50"
                                                    className="w-16 px-1 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                    placeholder="H"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Navigation - Right Side */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3">Navigation</h3>
                                    <div className="space-y-1">
                                        <UnifiedSlider
                                            label="Current Z layer"
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

                                        <UnifiedSlider
                                            label="Layers Above"
                                            value={tempFrameZLayersAbove ?? frameZLayersAbove}
                                            minValue={0}
                                            maxValue={msInfo.shape.z - 1 - zSlice}
                                            onChange={(value) => setTempFrameZLayersAbove(Array.isArray(value) ? value[0] : value)}
                                            onChangeCommitted={(value) => {
                                                setFrameZLayersAbove(Array.isArray(value) ? value[0] : value);
                                                setTempFrameZLayersAbove(null);
                                            }}
                                            valueDisplay={(val) => {
                                                const layers = Array.isArray(val) ? val[0] : val;
                                                const maxZ = msInfo.shape.z || 1;
                                                const actualEnd = Math.min(maxZ - 1, zSlice + layers);
                                                return `${layers} (up to Z ${actualEnd})`;
                                            }}
                                            condition={Boolean(msInfo.shape.z && msInfo.shape.z > 1)}
                                        />

                                        <UnifiedSlider
                                            label="Layers Below"
                                            value={tempFrameZLayersBelow ?? frameZLayersBelow}
                                            minValue={0}
                                            maxValue={zSlice}
                                            onChange={(value) => setTempFrameZLayersBelow(Array.isArray(value) ? value[0] : value)}
                                            onChangeCommitted={(value) => {
                                                setFrameZLayersBelow(Array.isArray(value) ? value[0] : value);
                                                setTempFrameZLayersBelow(null);
                                            }}
                                            valueDisplay={(val) => {
                                                const layers = Array.isArray(val) ? val[0] : val;
                                                const actualStart = Math.max(0, zSlice - layers);
                                                return `${layers} (down to Z ${actualStart})`;
                                            }}
                                            condition={Boolean(msInfo.shape.z && msInfo.shape.z > 1)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}