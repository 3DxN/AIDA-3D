import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import * as THREE from 'three';
import * as d3 from 'd3';

// Define the shape of a color map
interface ColorMap {
    featureMap: { name: string; value: string };
    colorScale: { name: string; value: (t: number) => string; };
    normalise: boolean;
}

// Define the context type
interface ColorMapContextType {
    colorMaps: ColorMap[];
    setColorMaps: React.Dispatch<React.SetStateAction<ColorMap[]>>;
    activeColorMapIndex: number;
    setActiveColorMapIndex: React.Dispatch<React.SetStateAction<number>>;
    globalProperties: React.MutableRefObject<{ nucleus_index: number;[key: string]: any }[]>;
    globalPropertyTypes: React.MutableRefObject<{ id: number; name: string; count: number; readOnly: boolean; dimensions?: number[] }[]>;
    featureData: any;
    setFeatureData: React.Dispatch<any>;
}

// Create the context
const ColorMapContext = createContext<ColorMapContextType | null>(null);

// Custom hook to use the context
export function useColorMap(): ColorMapContextType {
    const context = useContext(ColorMapContext);
    if (!context) {
        throw new Error('useColorMap must be used within a ColorMapProvider');
    }
    return context;
}

// Provider component
export function ColorMapProvider({ children }: { children: ReactNode }) {
    const [colorMaps, setColorMaps] = useState<ColorMap[]>([]);
    const [activeColorMapIndex, setActiveColorMapIndex] = useState(0);
    const [featureData, setFeatureData] = useState<any>(null);
    const globalProperties = useRef<{ nucleus_index: number;[key: string]: any }[]>([]);
    const globalPropertyTypes = useRef<{ id: number; name: string; count: number; readOnly: boolean; dimensions?: number[] }[]>([]);

    const value = {
        colorMaps,
        setColorMaps,
        activeColorMapIndex,
        setActiveColorMapIndex,
        globalProperties,
        globalPropertyTypes,
        featureData,
        setFeatureData,
    };

    return (
        <ColorMapContext.Provider value={value}>
            {children}
        </ColorMapContext.Provider>
    );
}