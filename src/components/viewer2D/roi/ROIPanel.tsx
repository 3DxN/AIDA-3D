'use client'

import { useState } from 'react'
import { TrashIcon, PencilIcon } from '@heroicons/react/solid'
import { useROI } from '../../../lib/contexts/ROIContext'

export default function ROIPanel() {
  const { 
    rois, selectedROI, isDrawing, isReshaping, 
    startDrawing, cancelDrawing, startReshaping, cancelReshaping, 
    navigateToROI, selectROI, deleteROI, updateROI 
  } = useROI()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  return (
    <div className="space-y-2">
      {isDrawing || isReshaping ? (
        <div className="space-y-2">
          <div className="text-xs text-teal-600 bg-teal-50 p-2 rounded">
            {isDrawing ? 'Click to add points. Click first point to close.' : 'Drag vertices to reshape ROI.'}
          </div>
          <button 
            onClick={isDrawing ? cancelDrawing : cancelReshaping} 
            className="w-full px-2 py-1.5 text-xs text-gray-600 border rounded hover:bg-gray-50"
          >
            {isDrawing ? 'Cancel Drawing' : 'Finish Reshaping'}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={startDrawing} className="flex-1 px-2 py-1.5 text-xs bg-teal-600 text-white rounded hover:bg-teal-700">
            Draw ROI
          </button>
          <button onClick={() => selectROI(null)} className="px-2 py-1.5 text-xs text-gray-600 border rounded hover:bg-gray-50" title="Deselect ROI and return to default view">
            Default View
          </button>
        </div>
      )}

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {rois.length === 0 && !isDrawing && (
          <div className="text-xs text-gray-500 text-center py-2">No ROIs. Click "Draw ROI" to create one.</div>
        )}
        {rois.map(roi => (
          <div key={roi.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer ${selectedROI?.id === roi.id ? 'bg-teal-100 ring-1 ring-teal-500' : 'hover:bg-gray-100'}`}>
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: roi.color }} />
            {editingId === roi.id ? (
              <input
                type="text" value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                className="flex-1 px-1 py-0.5 text-xs border rounded"
                onKeyDown={e => {
                  if (e.key === 'Enter') { updateROI(roi.id, { name: editName }); setEditingId(null) }
                  if (e.key === 'Escape') setEditingId(null)
                }}
                onBlur={() => { updateROI(roi.id, { name: editName }); setEditingId(null) }}
              />
            ) : (
              <div 
                className="flex-1 min-w-0" 
                onClick={() => {
                  if (selectedROI?.id === roi.id) {
                    selectROI(null)
                  } else {
                    navigateToROI(roi.id)
                  }
                }}
              >
                <div className="text-xs font-medium truncate">{roi.name}</div>
                <div className="text-xs text-gray-400">Z: {roi.zRange[0]}-{roi.zRange[1]}</div>
              </div>
            )}
            
            <div className="flex items-center">
              <button 
                onClick={(e) => { 
                  e.stopPropagation();
                  setEditingId(roi.id); 
                  setEditName(roi.name);
                }} 
                className="p-1 text-gray-400 hover:text-teal-600"
                title="Rename ROI"
              >
                <PencilIcon className="w-3 h-3" />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  startReshaping(roi.id);
                }}
                className={`p-1 ${isReshaping && selectedROI?.id === roi.id ? 'text-teal-600' : 'text-gray-400 hover:text-teal-600'}`}
                title="Reshape ROI vertices"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h6" />
                  <path d="M12 13l4 4 4-4" />
                  <path d="M16 17V9" />
                  <circle cx="5" cy="5" r="1" fill="currentColor" />
                  <circle cx="19" cy="5" r="1" fill="currentColor" />
                  <circle cx="5" cy="19" r="1" fill="currentColor" />
                </svg>
              </button>
            </div>

            {confirmDelete === roi.id ? (
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => { deleteROI(roi.id); setConfirmDelete(null) }} className="px-1.5 py-0.5 text-xs bg-red-600 text-white rounded">Delete</button>
                <button onClick={() => setConfirmDelete(null)} className="px-1.5 py-0.5 text-xs text-gray-600 border rounded">Cancel</button>
              </div>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(roi.id) }} className="p-1 text-gray-400 hover:text-red-600">
                <TrashIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
