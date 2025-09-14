import React from 'react'

interface SelectionBoxProps {
    selectionBox: {
        isDragging: boolean
        startPos: [number, number]
        currentPos: [number, number]
    }
    containerSize: { width: number; height: number }
}

export const SelectionBox: React.FC<SelectionBoxProps> = ({ selectionBox, containerSize }) => {
    if (!selectionBox.isDragging) {
        return null
    }

    const [startX, startY] = selectionBox.startPos
    const [currentX, currentY] = selectionBox.currentPos

    // Calculate box dimensions
    const left = Math.min(startX, currentX)
    const top = Math.min(startY, currentY)
    const width = Math.abs(currentX - startX)
    const height = Math.abs(currentY - startY)

    return (
        <div
            style={{
                position: 'absolute',
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`,
                border: '2px dashed #3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                pointerEvents: 'none',
                zIndex: 1000,
            }}
        />
    )
}