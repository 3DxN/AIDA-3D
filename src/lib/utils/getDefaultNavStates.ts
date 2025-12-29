import type { DataType } from 'zarrita';

import type { IMultiscaleInfo } from '../../types/metadata/loader';
import type { NavigationState } from '../../types/viewer2D/navState';
import type { ChannelMapping } from '../../types/viewer2D/navTypes';


// Helper to get default contrast limits for dtype
export function getDefaultMaxContrastLimit(dtype: DataType | string): number {
    const dtypeLower = String(dtype).toLowerCase();
    let max = 4095

    if (dtypeLower === 'uint8' || dtypeLower.includes('u1') || dtypeLower.includes('|u1')) {
        max = 255;
    } else if (dtypeLower === 'uint16' || dtypeLower.includes('u2') || dtypeLower.includes('<u2')) {
        max = 65535;
    } else if (dtypeLower === 'uint32' || dtypeLower.includes('u4')) {
        max = 4294967295;
    } else if (dtypeLower.includes('float') || dtypeLower.includes('f4') || dtypeLower.includes('f8')) {
        // Float32/Float64 - assume normalized 0-1 range as fallback
        max = 1.0;
    }

    console.log(`🔢 dtype "${dtype}" -> maxContrastLimit ${max}`);
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

export function getInitialNavigationState(msInfo: IMultiscaleInfo, omeAttrs?: any): NavigationState {
    const dtype = msInfo.dtype;
    const channelCount = msInfo.channels.length;
    const isGrayscale = channelCount < 2;
    const dtypeMax = getDefaultMaxContrastLimit(dtype);

    // 🛡️ FIX: Use OMERO window settings if available to prevent black/white clipping
    let contrastMax: number;
    let contrastMin = 0;
    let effectiveMaxIntensity = dtypeMax; // For H&E shader

    const omeroChannels = omeAttrs?.omero?.channels;
    if (omeroChannels && omeroChannels.length > 0) {
        // Use first channel's window for defaults
        const ch0Window = omeroChannels[0]?.window;
        if (ch0Window) {
            contrastMin = Number(ch0Window.start) || 0;
            contrastMax = Number(ch0Window.end) || Number(ch0Window.max) || dtypeMax;
            // 🛡️ FIX: Use OMERO max for H&E shader too, not just contrast
            effectiveMaxIntensity = Number(ch0Window.max) || contrastMax;
            console.log(`🎯 Using OMERO window: [${contrastMin}, ${contrastMax}], max=${effectiveMaxIntensity}`);
        } else {
            contrastMax = dtypeMax;
            console.log(`⚠️ OMERO channels exist but no window, using dtype max: ${contrastMax}`);
        }
    } else {
        // Fallback to dtype-based defaults
        const dtypeLower = String(dtype).toLowerCase();
        const isFloat = dtypeLower.includes('float') || dtypeLower.includes('f4') || dtypeLower.includes('f8');
        // 🛡️ FIX: For Float32, use a sensible default instead of 1.0
        // Many Float32 images have values in 0-255 or 0-1000 range
        contrastMax = isFloat ? 255 : Math.min(dtypeMax, 10000);
        effectiveMaxIntensity = contrastMax;
        console.log(`⚠️ No OMERO metadata, using fallback contrastMax: ${contrastMax} (isFloat: ${isFloat})`);
    }

    // 🛡️ DEFENSIVE: Ensure values are valid numbers
    if (!Number.isFinite(contrastMin)) contrastMin = 0;
    if (!Number.isFinite(contrastMax) || contrastMax <= contrastMin) contrastMax = 255;
    if (!Number.isFinite(effectiveMaxIntensity)) effectiveMaxIntensity = contrastMax;

    // 🛡️ FIX: Create contrast limits array matching actual channel count
    // For grayscale (1 channel), only create ONE entry
    const contrastLimits: [number, number][] = isGrayscale
        ? [[contrastMin, contrastMax]]
        : [[contrastMin, contrastMax * 0.5], [contrastMin, contrastMax * 0.3]];

    console.log(`📊 Initial contrast limits: ${JSON.stringify(contrastLimits)} (${isGrayscale ? 'grayscale' : 'multi-channel'})`);

    return {
        xOffset: 0,
        yOffset: 0,
        zSlice: msInfo.shape.z ? Math.floor(msInfo.shape.z / 2) : 0,
        timeSlice: 0,
        contrastLimits,
        channelMap: getDefaultChannelMap(msInfo.channels),
        cellposeOverlayOn: true,
        histogramEqualizationOn: false,
        // FORCE DISABLE H&E for MRI stability
        heStainingOn: !isGrayscale,
        // Beer-Lambert H&E staining parameters
        heStainHematoxylinWeight: 2.56,
        heStainEosinWeight: 0.1,
        // 🛡️ FIX: Use OMERO-derived max for H&E shader
        heStainMaxIntensity: effectiveMaxIntensity
    }
}
