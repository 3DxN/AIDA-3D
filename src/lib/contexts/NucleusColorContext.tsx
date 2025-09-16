'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import * as THREE from 'three'

interface NucleusColorInfo {
    nucleusIndex: number
    color: THREE.Color
    isSelected: boolean
}

interface NucleusColorContextType {
    nucleusColors: Map<number, THREE.Color>
    setNucleusColor: (nucleusIndex: number, color: THREE.Color) => void
    getNucleusColor: (nucleusIndex: number) => THREE.Color | null
    clearColors: () => void
    updateNucleusColors: (colorMap: Map<number, THREE.Color>) => void
}

const NucleusColorContext = createContext<NucleusColorContextType | null>(null)

export function useNucleusColor(): NucleusColorContextType {
    const context = useContext(NucleusColorContext)
    if (!context) {
        throw new Error('useNucleusColor must be used within a NucleusColorProvider')
    }
    return context
}

interface NucleusColorProviderProps {
    children: React.ReactNode
}

export function NucleusColorProvider({ children }: NucleusColorProviderProps) {
    const [nucleusColors, setNucleusColors] = useState<Map<number, THREE.Color>>(new Map())

    const setNucleusColor = useCallback((nucleusIndex: number, color: THREE.Color) => {
        setNucleusColors(prev => {
            const newMap = new Map(prev)
            newMap.set(nucleusIndex, color.clone())
            return newMap
        })
    }, [])

    const getNucleusColor = useCallback((nucleusIndex: number): THREE.Color | null => {
        return nucleusColors.get(nucleusIndex) || null
    }, [nucleusColors])

    const clearColors = useCallback(() => {
        setNucleusColors(new Map())
    }, [])

    const updateNucleusColors = useCallback((colorMap: Map<number, THREE.Color>) => {
        setNucleusColors(new Map(colorMap))
    }, [])

    const contextValue: NucleusColorContextType = {
        nucleusColors,
        setNucleusColor,
        getNucleusColor,
        clearColors,
        updateNucleusColors
    }

    return (
        <NucleusColorContext.Provider value={contextValue}>
            {children}
        </NucleusColorContext.Provider>
    )
}