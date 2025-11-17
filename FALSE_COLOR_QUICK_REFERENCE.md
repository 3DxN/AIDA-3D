# False-Color Channel Mixing - Quick Reference

## Color Scheme
```
┌─────────────────────────────────────────────────┐
│         False-Color Rendering Scheme            │
├─────────────────────────────────────────────────┤
│                                                 │
│  Nucleus (Green)         #00FF00  [0, 255, 0]  │
│  Cytoplasm (Red)         #FF0000  [255, 0, 0]  │
│  Colocalization (Yellow) #FFFF00  [255, 255, 0]│
│  Background (Black)      #000000  [0, 0, 0]    │
│                                                 │
└─────────────────────────────────────────────────┘
```

## User Interactions

### Single Channel Mode
```
User selects: nucleus = Channel 2, cytoplasm = null
        ↓
Display: Green channel with nucleus intensity
```

### Dual Channel Mode (False-Color)
```
User selects: nucleus = Channel 0, cytoplasm = Channel 1
        ↓
Display: Composite false-color image
         - Red regions = cytoplasm
         - Green regions = nucleus
         - Yellow regions = both present (colocalization)
```

### Channel Switching
```
User changes: nucleus from Channel 0 to Channel 2
        ↓
Color stays: Green (nucleus role)
Data loads: Channel 2 data instead of Channel 0
Viv renders: Updated composite immediately
```

## Code Usage

### Check if False-Color Active
```typescript
import { shouldUseFalseColor, getRenderingMode } from './channelMixer'

if (shouldUseFalseColor(channelMap)) {
  // Both nucleus and cytoplasm selected
  // Use false-color rendering
}

const mode = getRenderingMode(channelMap) // 'single' | 'dual'
```

### Access Rendering Metadata
```typescript
// From layer props in components
const { falseColorMode } = layerProps

if (falseColorMode?.enabled) {
  console.log('False-color rendering active')
  console.log('Nucleus channel:', falseColorMode.nucleusChannelIndex)
  console.log('Cytoplasm channel:', falseColorMode.cytoplasmChannelIndex)
}
```

### Mix Channels Manually (Advanced)
```typescript
import { mixChannelsToRGB } from './channelMixer'

const nucleusData = new Uint16Array([...])
const cytoplasmData = new Uint16Array([...])

const rgbData = mixChannelsToRGB(
  nucleusData,      // Uint16Array of nucleus values
  cytoplasmData,    // Uint16Array of cytoplasm values
  65535,            // Scale factor for uint16
  65535             // Scale factor for uint16
)
// Returns: Uint8Array with interleaved [R, G, B, R, G, B, ...]
```

## File Structure
```
src/
├── lib/
│   ├── utils/
│   │   └── channelMixer.ts          ← New: Channel mixing functions
│   └── hooks/
│       └── useVivViewer.ts          ← Updated: Color logic + metadata
└── types/
    └── viewer2D/
        └── vivViewer.ts             ← Updated: Extended VivLayerProps
```

## Data Flow

```
┌──────────────────────────────────────────────────────┐
│ User selects channels (nucleus, cytoplasm)           │
└────────────────────┬─────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────┐
│ shouldUseFalseColor() checks if both selected        │
└────────────────────┬─────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────┐
│ Color assignment: Nucleus→Green, Cytoplasm→Red       │
└────────────────────┬─────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────┐
│ Viv renders layers with assigned colors              │
│ Overlapping pixels show as Yellow (R + G)            │
└────────────────────┬─────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────┐
│ falseColorMode metadata added to layer props          │
└────────────────────┬─────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────┐
│ Overlay components can use metadata if needed        │
└──────────────────────────────────────────────────────┘
```

## Performance Notes

| Operation | Complexity | When |
|-----------|-----------|------|
| False-color detection | O(1) | On channel selection |
| Color assignment | O(n) | Per render (n=channels) |
| RGB mixing (CPU) | O(pixels) | Only if manually called |
| RGB mixing (GPU shader) | O(pixels) | Future optimization |

**Current**: Minimal overhead - only metadata and color assignments  
**Future**: Can add GPU shader for full pixel mixing if needed

## Common Patterns

### Pattern 1: Detect False-Color Mode
```typescript
const useFalseColor = shouldUseFalseColor(navigationState.channelMap)
const renderingMode = getRenderingMode(navigationState.channelMap)

if (useFalseColor && renderingMode === 'dual') {
  // Apply false-color-specific UI/behavior
}
```

### Pattern 2: Access Channel Info from Layer Props
```typescript
const {
  colors,
  falseColorMode,
  selections,
  contrastLimits
} = layerProps[0]

console.log(colors) // [[0, 255, 0], [255, 0, 0]]
console.log(falseColorMode.enabled) // true
```

### Pattern 3: Conditional Component Rendering
```typescript
{falseColorMode?.enabled && (
  <FalseColorInfo
    nucleus={falseColorMode.nucleusChannelIndex}
    cytoplasm={falseColorMode.cytoplasmChannelIndex}
  />
)}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Colors not updating | Cache issue | Check dependency array in useMemo |
| Wrong colors assigned | Channel order | Verify channelMap order (nucleus first) |
| Metadata not available | Old layer props | Ensure useVivViewer returns updated props |
| Mixing function errors | Type mismatch | Use Uint8Array or Uint16Array input |
