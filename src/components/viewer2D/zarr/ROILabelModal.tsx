'use client'

import React, { useState, useRef, useEffect } from 'react'

interface ROILabelModalProps {
    isOpen: boolean
    onConfirm: (label: string) => void
    onCancel: () => void
    defaultLabel?: string
}

export default function ROILabelModal({
    isOpen,
    onConfirm,
    onCancel,
    defaultLabel = ''
}: ROILabelModalProps) {
    const [label, setLabel] = useState(defaultLabel)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isOpen) {
            const newLabel = defaultLabel || `ROI ${new Date().toLocaleTimeString()}`
            setLabel(newLabel)
            // Focus the input after a short delay to ensure the modal is visible
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }, [isOpen, defaultLabel])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (label.trim()) {
            onConfirm(label.trim())
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onCancel()
        }
    }

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
            onKeyDown={handleKeyDown}
        >
            <div className="bg-white rounded-lg shadow-xl p-4 w-80">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Name this ROI</h3>
                <form onSubmit={handleSubmit}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Enter ROI label"
                    />
                    <div className="flex justify-end space-x-2 mt-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm text-white bg-teal-600 hover:bg-teal-700 rounded"
                        >
                            Create
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
