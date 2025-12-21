'use client'

import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, TrashIcon } from '@heroicons/react/solid'
import { Disclosure } from '@headlessui/react'
import { useViewer2DData } from '../../../../lib/contexts/Viewer2DDataContext'
import { useZarrStore } from '../../../../lib/contexts/ZarrStoreContext'
import { useROI } from '../../../../lib/contexts/ROIContext'

import UnifiedSlider from '../../../interaction/UnifiedSlider'
import Switch from '../../../interaction/Switch'
import ChannelSelector from './ChannelSelector'
import ContrastLimitsSelector from './ContrastLimitsSelector'
import CellposeOverlayResolutionSelector from './CellposeOverlayResolutionSelector'
import CellposeMeshResolutionSelector from './CellposeMeshResolutionSelector'

function classNames(...classes: (string | boolean | undefined)[]) {
    return classes.filter(Boolean).join(' ')
}

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

    // ROI state
    const { rois, saveCurrentAsROI, navigateToROI, deleteROI } = useROI()
    const [newROIName, setNewROIName] = useState('')
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

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

    const { zSlice, timeSlice, channelMap, contrastLimits, cellposeOverlayOn, histogramEqualizationOn } = navigationState

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
        onHistogramEqualizationToggle: (newState: boolean) => setNavigationState({
            ...navigationState,
            histogramEqualizationOn: newState
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
                <div className="bg-white border-l border-gray-200 h-screen shadow text-gray-800 flex flex-col divide-y w-48 absolute right-0 top-0 z-10 overflow-y-auto">
                    {/* Close button */}
                    <button
                        onClick={() => handleToggle(false)}
                        className="w-full flex justify-between hover:bg-gray-100 p-2 items-center focus:outline-none ring-inset focus:ring-2 focus:ring-teal-500"
                    >
                        Navigation Controls
                        <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                    </button>

                    {/* Navigation Content */}
                    {/* Segmentation Section */}
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
                                    Segmentation
                                </Disclosure.Button>
                                <Disclosure.Panel className="relative">
                                    <div className="mx-4 flex my-2 justify-between">
                                        <div className="text-sm">Cellpose Nuclei</div>
                                        <Switch
                                            enabled={cellposeOverlayOn}
                                            onChange={navigationHandlers.onCellposeOverlayToggle}
                                        />
                                    </div>
                                    {/* Cellpose Resolution Selectors */}
                                    <CellposeOverlayResolutionSelector />
                                    <CellposeMeshResolutionSelector />
                                </Disclosure.Panel>
                            </>
                        )}
                    </Disclosure>

                    {/* Channel Selection Section */}
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
                                    Channels
                                </Disclosure.Button>
                                <Disclosure.Panel className="relative">
                                    <div className="px-4 py-2">
                                        <ChannelSelector
                                            channelNames={msInfo.channels}
                                            channelMap={channelMap}
                                            onChannelChange={navigationHandlers.onChannelChange}
                                        />
                                    </div>
                                </Disclosure.Panel>
                            </>
                        )}
                    </Disclosure>

                    {/* Contrast Limits Section */}
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
                                    Contrast
                                </Disclosure.Button>
                                <Disclosure.Panel className="relative">
                                    <div className="px-4 py-2 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <div className="text-sm">Histogram Equalization</div>
                                            <Switch
                                                enabled={histogramEqualizationOn}
                                                onChange={navigationHandlers.onHistogramEqualizationToggle}
                                            />
                                        </div>
                                        <ContrastLimitsSelector
                                            contrastLimitsProps={{
                                                contrastLimits,
                                                maxContrastLimit,
                                                onContrastLimitsChange: navigationHandlers.onContrastLimitsChange
                                            }}
                                            channelMap={channelMap}
                                        />
                                    </div>
                                </Disclosure.Panel>
                            </>
                        )}
                    </Disclosure>

                    {/* Frame Section */}
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
                                    Frame
                                </Disclosure.Button>
                                <Disclosure.Panel className="relative">
                                    <div className="px-4 py-2 space-y-3">
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
                                </Disclosure.Panel>
                            </>
                        )}
                    </Disclosure>

                    {/* ROI Section */}
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
                                    ROI
                                </Disclosure.Button>
                                <Disclosure.Panel className="relative">
                                    <div className="px-4 py-2 space-y-2">
                                        {/* Save current view as ROI */}
                                        <div className="flex gap-1">
                                            <input
                                                type="text"
                                                value={newROIName}
                                                onChange={(e) => setNewROIName(e.target.value)}
                                                placeholder="ROI name..."
                                                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && newROIName.trim()) {
                                                        saveCurrentAsROI(newROIName.trim())
                                                        setNewROIName('')
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={() => {
                                                    saveCurrentAsROI(newROIName.trim() || `ROI ${rois.length + 1}`)
                                                    setNewROIName('')
                                                }}
                                                className="px-2 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700"
                                            >
                                                Save
                                            </button>
                                        </div>

                                        {/* ROI list */}
                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                            {rois.length === 0 && (
                                                <div className="text-xs text-gray-400 text-center py-1">No saved ROIs</div>
                                            )}
                                            {rois.map(roi => (
                                                <div
                                                    key={roi.id}
                                                    className="flex items-center gap-1 p-1.5 rounded hover:bg-gray-100 cursor-pointer group"
                                                    onClick={() => navigateToROI(roi.id)}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-medium truncate">{roi.name}</div>
                                                        <div className="text-xs text-gray-400">
                                                            Z:{roi.zSlice} ({roi.zLayersBelow}↓ {roi.zLayersAbove}↑)
                                                        </div>
                                                    </div>
                                                    {confirmDeleteId === roi.id ? (
                                                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => { deleteROI(roi.id); setConfirmDeleteId(null) }}
                                                                className="px-1.5 py-0.5 text-xs bg-red-600 text-white rounded"
                                                            >
                                                                Delete
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmDeleteId(null)}
                                                                className="px-1.5 py-0.5 text-xs text-gray-600 border rounded"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(roi.id) }}
                                                            className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                                                        >
                                                            <TrashIcon className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Disclosure.Panel>
                            </>
                        )}
                    </Disclosure>

                    {/* Navigation Section */}
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
                                    Navigation
                                </Disclosure.Button>
                                <Disclosure.Panel className="relative">
                                    <div className="px-4 py-2 space-y-1">
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
                                </Disclosure.Panel>
                            </>
                        )}
                    </Disclosure>
                </div>
            )}
        </>
    )
}