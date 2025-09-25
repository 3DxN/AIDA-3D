'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'

interface NucleusSelectionContextType {
    selectedNucleiIndices: number[]
    setSelectedNucleiIndices: (indices: number[]) => void
    addSelectedNucleus: (index: number) => void
    removeSelectedNucleus: (index: number) => void
    clearSelection: () => void
}

const NucleusSelectionContext = createContext<NucleusSelectionContextType | null>(null)

export function useNucleusSelection(): NucleusSelectionContextType {
    const context = useContext(NucleusSelectionContext)
    if (!context) {
        throw new Error('useNucleusSelection must be used within a NucleusSelectionProvider')
    }
    return context
}

interface NucleusSelectionProviderProps {
    children: React.ReactNode
}

export function NucleusSelectionProvider({ children }: NucleusSelectionProviderProps) {
    const [selectedNucleiIndices, setSelectedNucleiIndices] = useState<number[]>([])

    const addSelectedNucleus = useCallback((index: number) => {
        setSelectedNucleiIndices(prev => {
            if (!prev.includes(index)) {
                return [...prev, index]
            }
            return prev
        })
    }, [])

    const removeSelectedNucleus = useCallback((index: number) => {
        setSelectedNucleiIndices(prev => prev.filter(i => i !== index))
    }, [])

    const clearSelection = useCallback(() => {
        setSelectedNucleiIndices([])
    }, [])

    const contextValue: NucleusSelectionContextType = {
        selectedNucleiIndices,
        setSelectedNucleiIndices,
        addSelectedNucleus,
        removeSelectedNucleus,
        clearSelection
    }

    return (
        <NucleusSelectionContext.Provider value={contextValue}>
            {children}
        </NucleusSelectionContext.Provider>
    )
}