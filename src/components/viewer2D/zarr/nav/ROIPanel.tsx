'use client'

import { Disclosure } from '@headlessui/react'
import { TrashIcon, PlusIcon, XIcon } from '@heroicons/react/solid'
import { useROI } from '../../../../lib/contexts/ROIContext'
import { useViewer2DData } from '../../../../lib/contexts/Viewer2DDataContext'
import Switch from '../../../interaction/Switch'

function classNames(...classes: (string | boolean | undefined)[]) {
    return classes.filter(Boolean).join(' ')
}

export default function ROIPanel() {
    const {
        rois,
        selectedROIIds,
        toggleROISelection,
        removeROIs,
        roisVisible,
        setROIsVisible,
        drawingState,
        startDrawing,
        cancelDrawing,
        getROIBoundingBox
    } = useROI()

    const {
        setFrameCenter,
        navigationState,
        setNavigationState
    } = useViewer2DData()

    // Navigate to ROI when clicking hyperlink
    const handleNavigateToROI = (roiId: string) => {
        const roi = rois.find(r => r.id === roiId)
        if (!roi || !navigationState) return

        const bbox = getROIBoundingBox(roi)

        // Move frame center to ROI center (only X,Y)
        setFrameCenter([bbox.centerX, bbox.centerY])

        // Navigate to the ROI's z-slice if different
        if (roi.zSlice !== navigationState.zSlice) {
            setNavigationState({
                ...navigationState,
                zSlice: roi.zSlice
            })
        }
    }

    // Delete selected ROIs
    const handleDeleteSelected = () => {
        if (selectedROIIds.length > 0) {
            removeROIs(selectedROIIds)
        }
    }

    return (
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
                        ROIs ({rois.length})
                    </Disclosure.Button>

                    <Disclosure.Panel className="relative">
                        <div className="px-4 py-2 space-y-3">
                            {/* Visibility Toggle */}
                            <div className="flex justify-between items-center">
                                <div className="text-sm">Show ROIs</div>
                                <Switch
                                    enabled={roisVisible}
                                    onChange={setROIsVisible}
                                />
                            </div>

                            {/* Drawing Mode Toggle */}
                            <div className="flex justify-between items-center">
                                {drawingState.isDrawing ? (
                                    <button
                                        onClick={cancelDrawing}
                                        className="flex items-center text-sm text-red-600 hover:text-red-800"
                                    >
                                        <XIcon className="h-4 w-4 mr-1" />
                                        Cancel Drawing
                                    </button>
                                ) : (
                                    <button
                                        onClick={startDrawing}
                                        className="flex items-center text-sm text-teal-600 hover:text-teal-800"
                                    >
                                        <PlusIcon className="h-4 w-4 mr-1" />
                                        Draw New ROI
                                    </button>
                                )}
                            </div>

                            {/* Drawing Instructions */}
                            {drawingState.isDrawing && (
                                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                                    Click to add vertices. Double-click or click first point to close polygon.
                                    <br />
                                    Vertices: {drawingState.currentVertices.length}
                                </div>
                            )}

                            {/* ROI List */}
                            {rois.length > 0 ? (
                                <div className="border rounded max-h-40 overflow-y-auto">
                                    {rois.map(roi => (
                                        <div
                                            key={roi.id}
                                            className={classNames(
                                                'flex items-center px-2 py-1 text-sm border-b last:border-b-0',
                                                selectedROIIds.includes(roi.id)
                                                    ? 'bg-teal-50'
                                                    : 'hover:bg-gray-50'
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedROIIds.includes(roi.id)}
                                                onChange={() => toggleROISelection(roi.id)}
                                                className="mr-2 h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                                            />
                                            <button
                                                onClick={() => handleNavigateToROI(roi.id)}
                                                className="flex-1 text-left text-teal-600 hover:text-teal-800 hover:underline truncate"
                                            >
                                                {roi.label}
                                            </button>
                                            <span className="text-xs text-gray-400 ml-1">
                                                Z:{roi.zSlice}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-xs text-gray-400 italic">
                                    No ROIs created yet
                                </div>
                            )}

                            {/* Delete Button */}
                            {selectedROIIds.length > 0 && (
                                <button
                                    onClick={handleDeleteSelected}
                                    className="w-full flex items-center justify-center px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded"
                                >
                                    <TrashIcon className="h-4 w-4 mr-1" />
                                    Delete Selected ({selectedROIIds.length})
                                </button>
                            )}
                        </div>
                    </Disclosure.Panel>
                </>
            )}
        </Disclosure>
    )
}
