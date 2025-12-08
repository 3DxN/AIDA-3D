import type { DataType } from 'zarrita';

import type { IMultiscaleInfo } from '../../types/metadata/loader';
import type { NavigationState } from '../../types/viewer2D/navState';
import type { ChannelMapping } from '../../types/viewer2D/navTypes';


// Helper to get default contrast limits for dtype
export function getDefaultMaxContrastLimit(dtype: DataType): number {
    let max = 4095
    switch (dtype) {
        case 'uint8':
            max = 255;
            break;
        case 'uint16':
            max = 65535;
            break;
        case 'uint32':
            max = 4294967295;
            break;
        case 'float32':
        case 'float64':
            max = 1.0;
            break;
        default:
            max = 4095; // Default for other types
    }
    return max;
}

// Helper to get default channel map (role -> index)
export function getDefaultChannelMap(availableChannels: string[]): ChannelMapping {
    // Assign first two channels to nucleus/cytoplasm if available, else just index 0, 1
    return {
        nucleus: availableChannels[0] ? 0 : null,
        cytoplasm: availableChannels[1] ? 1 : null
    }
}

// Centralized navigation state initialization
export function getInitialNavigationState(msInfo: IMultiscaleInfo): NavigationState {
    const dtype = msInfo.dtype;
    return {
        xOffset: 0,
        yOffset: 0,
        zSlice: msInfo.shape.z ? Math.floor(msInfo.shape.z / 2) : 0,
        timeSlice: 0,
        contrastLimits: [[0, 1000], [0, 300]], // nucleus: [0, 1000], cytoplasm: [0, 300]
        channelMap: getDefaultChannelMap(msInfo.channels),
        cellposeOverlayOn: true,
        histogramEqualizationOn: false,
        heStainingOn: false,
    }
}