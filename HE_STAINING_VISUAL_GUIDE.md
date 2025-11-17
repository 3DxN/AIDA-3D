# H&E Staining - Visual Implementation Guide

## Component Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         AIDA-3D 2D Viewer Architecture                        │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                    Navigation Controls Panel (React)                     │ │
│  │                                                                          │ │
│  │  ┌──────────────────────────┐    ┌──────────────────────────────────┐  │ │
│  │  │   Channels Section       │    │   Contrast Section              │  │ │
│  │  │  ┌────────────────────┐  │    │  ┌────────────────────────────┐ │  │ │
│  │  │  │ Nucleus Channel    │  │    │  │ Histogram Equalization    │ │  │ │
│  │  │  │ [Dropdown: 0,1,2]  │◄─┼────┼─►│ [Toggle: ON/OFF]           │ │  │ │
│  │  │  └────────────────────┘  │    │  └────────────────────────────┘ │  │ │
│  │  │                          │    │  ┌────────────────────────────┐ │  │ │
│  │  │  ┌────────────────────┐  │    │  │ H&E Staining ◆ NEW        │ │  │ │
│  │  │  │ Cytoplasm Channel  │  │    │  │ [Toggle: ON/OFF]           │ │  │ │
│  │  │  │ [Dropdown: 0,1,2]  │◄─┼────┼─►│ (Disabled if missing)      │ │  │ │
│  │  │  └────────────────────┘  │    │  └────────────────────────────┘ │  │ │
│  │  └──────────────────────────┘    │  ┌────────────────────────────┐ │  │ │
│  │                                   │  │ Contrast Limits            │ │  │ │
│  │                                   │  │ (Nucleus, Cytoplasm)       │ │  │ │
│  │                                   │  └────────────────────────────┘ │  │ │
│  │                                   │                                 │  │ │
│  │                                   │  Warning: (if H&E on, chans ok) │  │ │
│  │                                   │  "H&E requires both channels"   │  │ │
│  │                                   └──────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                        ▲                                       │
│                                        │ navigationState.heStainingOn          │
│                                        │ navigationState.channelMap            │
│                                        │                                       │
└────────────────────────────────────────┼───────────────────────────────────────┘
                                         │
                    ┌────────────────────┴────────────────┐
                    │                                     │
                    ▼                                     ▼
        ┌───────────────────────┐          ┌─────────────────────────┐
        │ Viewer2DDataContext   │          │  ZarrStoreContext       │
        │  (State Manager)      │          │  (Data Source)          │
        │                       │          │                         │
        │ - navigationState ◄───┼──────────┼─ msInfo                 │
        │ - setNavState()       │          │ - shape, dtype, axes    │
        └───────────────────────┘          └─────────────────────────┘
                    │
                    │ navigationState prop with heStainingOn
                    │
                    ▼
        ┌───────────────────────────────────┐
        │  useVivViewer Hook (Color Logic)  │
        │                                   │
        │  Input:                           │
        │  - msInfo                         │
        │  - navigationState                │
        │    - heStainingOn ◆ NEW           │
        │    - channelMap                   │
        │                                   │
        │  Processing:                      │
        │  ┌─────────────────────────────┐  │
        │  │ const colors = useMemo(() => │  │
        │  │   const heStainingEnabled =  │  │
        │  │     heStainingOn &&          │  │
        │  │     shouldUseHEStaining()    │  │
        │  │                              │  │
        │  │   return Object.entries()    │  │
        │  │     .map(([role, idx]) => {  │  │
        │  │       if (heStainingEnabled) │  │
        │  │         if (nucleus)         │  │
        │  │           return [163,20,204]│  │
        │  │         if (cytoplasm)       │  │
        │  │           return [54,25,10]  │  │
        │  │       else                   │  │
        │  │         return [0,255,0|...]  │  │
        │  │     })                       │  │
        │  │ }, [channelMap, heStainingOn])│ │
        │  └─────────────────────────────┘  │
        │                                   │
        │  Output:                          │
        │  - colors array [[R,G,B], ...]   │
        │                                   │
        └───────────────────────────────────┘
                    │
                    │ colors prop
                    │
                    ▼
        ┌───────────────────────────────────┐
        │  Viv Viewer (HMS-DBMI)            │
        │                                   │
        │  - Applies colors to data         │
        │  - Multi-scale support            │
        │  - WebGL rendering                │
        │                                   │
        └───────────────────────────────────┘
                    │
                    │ Rendered pixels
                    │
                    ▼
        ┌───────────────────────────────────┐
        │  OpenLayers Canvas                │
        │                                   │
        │  H&E Mode:                        │
        │  - Nucleus: Blue-Purple           │
        │  - Cytoplasm: Pink-Red            │
        │  - Overlap: Purple-Red            │
        │                                   │
        │  False-Color Mode (disabled):     │
        │  - Nucleus: Green                 │
        │  - Cytoplasm: Red                 │
        │  - Overlap: Yellow                │
        │                                   │
        └───────────────────────────────────┘
```

## Color Transformation Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                  H&E Color Mapping Pipeline                       │
└──────────────────────────────────────────────────────────────────┘

Step 1: Extract State
─────────────────────
  navigationState = {
    channelMap: { nucleus: 0, cytoplasm: 1 },
    heStainingOn: true
  }

Step 2: Check Conditions
────────────────────────
  canUseHEStaining = shouldUseHEStaining(channelMap)
                   = nucleus !== null && cytoplasm !== null
                   = 0 !== null && 1 !== null
                   = true

  heStainingEnabled = heStainingOn && canUseHEStaining
                    = true && true
                    = true

Step 3: Map Channels to Colors
──────────────────────────────
  For nucleus (index 0):
    if (heStainingEnabled)
      if (role === 'nucleus')
        return [163, 20, 204]  // Hematoxylin
      
  For cytoplasm (index 1):
    if (heStainingEnabled)
      if (role === 'cytoplasm')
        return [54, 25, 10]    // Eosin

Step 4: Generate Colors Array
──────────────────────────────
  colors = [
    [163, 20, 204],  // Nucleus → Hematoxylin (Blue-purple)
    [54, 25, 10]     // Cytoplasm → Eosin (Pink-red)
  ]

Step 5: Apply to Viv Viewer
───────────────────────────
  vivViewer.setProps({ colors })

Step 6: Render to Canvas
────────────────────────
  Canvas displays:
  - Nucleus regions in blue-purple (#A314CC)
  - Cytoplasm regions in pink-red (#36190A)
  - Natural color blending at overlaps
```

## State Dependency Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                  Reactive State Dependencies                      │
└──────────────────────────────────────────────────────────────────┘

User Action: Select Nucleus and Cytoplasm Channels
────────────────────────────────────────────────────
        │
        ▼
navigationState.channelMap = { nucleus: 0, cytoplasm: 1 }
        │
        ├─► shouldUseHEStaining(channelMap) = true
        │   (Both channels available)
        │
        ├─► H&E toggle becomes ENABLED
        │
        └─► colors useMemo dependency detected
            
            colors = useMemo(() => {
              // nucleus: 0 → [163, 20, 204]
              // cytoplasm: 1 → [54, 25, 10]
            }, [channelMap])
            
            ▼
        Viv viewer re-renders with these colors

────────────────────────────────────────────────────

User Action: Toggle H&E ON
──────────────────────────
        │
        ▼
navigationState.heStainingOn = true
        │
        └─► colors useMemo dependency detected
            
            colors = useMemo(() => {
              heStainingEnabled = true && true = true
              
              // nucleus: [163, 20, 204] (Hematoxylin)
              // cytoplasm: [54, 25, 10] (Eosin)
            }, [channelMap, heStainingOn])
            
            ▼
        Viv viewer re-renders with H&E colors

────────────────────────────────────────────────────

User Action: Deselect Cytoplasm
──────────────────────────────
        │
        ▼
navigationState.channelMap = { nucleus: 0, cytoplasm: null }
        │
        ├─► shouldUseHEStaining(channelMap) = false
        │   (Missing cytoplasm channel)
        │
        ├─► H&E toggle becomes DISABLED
        │
        └─► colors useMemo dependency detected
            
            colors = useMemo(() => {
              heStainingEnabled = true && false = false
              
              // nucleus: [0, 255, 0] (Green fallback)
            }, [channelMap, heStainingOn])
            
            ▼
        Viv viewer re-renders with fallback colors
```

## Toggle State Machine

```
┌──────────────────────────────────────────────────────────────────┐
│           H&E Staining Toggle State Machine                       │
└──────────────────────────────────────────────────────────────────┘

Initial State: H&E Disabled
──────────────────────────
  heStainingOn: false
  channelMap: { nucleus: null, cytoplasm: null }
  Toggle UI: Disabled
  Colors: Not applied


Transition 1: User Selects Both Channels
─────────────────────────────────────────
  heStainingOn: false (unchanged)
  channelMap: { nucleus: 0, cytoplasm: 1 }
  Toggle UI: ENABLED (now clickable)
  Colors: H&E available (not applied yet)


Transition 2: User Clicks H&E Toggle
────────────────────────────────────
  heStainingOn: true
  channelMap: { nucleus: 0, cytoplasm: 1 }
  Toggle UI: Enabled (and checked)
  Colors: H&E APPLIED
           nucleus → [163, 20, 204]
           cytoplasm → [54, 25, 10]
  Viewer: Shows blue-purple nucleus, pink-red cytoplasm


Transition 3: User Deselects Cytoplasm
──────────────────────────────────────
  heStainingOn: true (but ignored)
  channelMap: { nucleus: 0, cytoplasm: null }
  Toggle UI: DISABLED (unchecked, greyed out)
  Colors: Fallback applied
           nucleus → [0, 255, 0]
  Warning: "H&E staining requires both nucleus and cytoplasm..."


Transition 4: User Selects Cytoplasm Again
──────────────────────────────────────────
  heStainingOn: true (remembered)
  channelMap: { nucleus: 0, cytoplasm: 1 }
  Toggle UI: ENABLED (checked)
  Colors: H&E REAPPLIED
           nucleus → [163, 20, 204]
           cytoplasm → [54, 25, 10]
  Warning: Cleared


Transition 5: User Clicks H&E Toggle OFF
────────────────────────────────────────
  heStainingOn: false
  channelMap: { nucleus: 0, cytoplasm: 1 }
  Toggle UI: Enabled (unchecked)
  Colors: False-Color applied
           nucleus → [0, 255, 0]
           cytoplasm → [255, 0, 0]
  Viewer: Shows green nucleus, red cytoplasm

```

## Color Space Visualization

```
┌──────────────────────────────────────────────────────────────────┐
│              H&E Color Space vs Standard False-Color              │
└──────────────────────────────────────────────────────────────────┘

H&E STAINING MODE (Professional Histopathology)
────────────────────────────────────────────────

Nucleus Channel:
┌─────────────────────────────────────────┐
│ Hematoxylin Color: [163, 20, 204]       │
│ ███████████████████ BLUE-PURPLE         │
│ RGB: (163, 20, 204)                     │
│ Hex: #A314CC                            │
│ Resembles: Traditional H&E stained      │
│            nucleus (purple/indigo)      │
└─────────────────────────────────────────┘

Cytoplasm Channel:
┌─────────────────────────────────────────┐
│ Eosin Color: [54, 25, 10]               │
│ ██████ PINK-RED                         │
│ RGB: (54, 25, 10)                       │
│ Hex: #36190A                            │
│ Resembles: Traditional H&E stained      │
│            cytoplasm (pink/salmon)      │
└─────────────────────────────────────────┘

Overlap/Mixed:
┌─────────────────────────────────────────┐
│ Natural blend: Purple-red mauve          │
│ Resembles: Real tissue with both        │
│            nucleus and cytoplasm        │
└─────────────────────────────────────────┘


FALSE-COLOR MODE (Standard - H&E Disabled)
──────────────────────────────────────────

Nucleus Channel:
┌─────────────────────────────────────────┐
│ Green: [0, 255, 0]                      │
│ ██████████ GREEN                        │
│ RGB: (0, 255, 0)                        │
│ Hex: #00FF00                            │
│ Good for: Quick visualization, debugging│
└─────────────────────────────────────────┘

Cytoplasm Channel:
┌─────────────────────────────────────────┐
│ Red: [255, 0, 0]                        │
│ ██████████ RED                          │
│ RGB: (255, 0, 0)                        │
│ Hex: #FF0000                            │
└─────────────────────────────────────────┘

Overlap/Mixed:
┌─────────────────────────────────────────┐
│ Yellow: [255, 255, 0]                   │
│ ██████████ YELLOW                       │
│ High contrast for identifying overlaps  │
└─────────────────────────────────────────┘
```

## Files Modified - Visual Map

```
AIDA-3D Project Structure
═════════════════════════

src/
├── lib/
│   ├── utils/
│   │   ├── channelMixer.ts ●●●●● MODIFIED (114 lines added)
│   │   │   ├── HE_STAIN_COLORS (new)
│   │   │   ├── mixChannelsToHEStain() (new)
│   │   │   └── createHEStainMixer() (new)
│   │   │
│   │   └── getDefaultNavStates.ts ● MODIFIED (1 line added)
│   │       └── heStainingOn: false (new)
│   │
│   ├── hooks/
│   │   └── useVivViewer.ts ●●● MODIFIED (17 lines added)
│   │       └── colors useMemo (updated with H&E logic)
│   │
│   └── contexts/
│       └── Viewer2DDataContext.tsx ✓ COMPATIBLE (no changes)
│
├── types/
│   └── viewer2D/
│       └── navState.ts ● MODIFIED (4 lines added)
│           └── heStainingOn: boolean (new)
│
└── components/
    └── viewer2D/
        └── zarr/
            └── nav/
                └── navigator.tsx ●● MODIFIED (19 lines added)
                    ├── Import shouldUseHEStaining
                    ├── Extract heStainingOn from state
                    ├── Add onHEStainingToggle handler
                    └── Add H&E toggle UI in Contrast section

Documentation/
═════════════
├── HE_STAIN_IMPLEMENTATION.md (new, 350+ lines)
├── HE_STAINING_UI_TOGGLE.md (new, 250+ lines)
├── HE_STAINING_INTEGRATION.md (new, 300+ lines)
├── HE_STAINING_COMPLETE_GUIDE.md (new, 500+ lines)
├── HE_STAINING_IMPLEMENTATION_SUMMARY.md (new, 400+ lines)
└── HE_STAINING_VERIFICATION_REPORT.md (new, 250+ lines)

Legend:
● Small change (1-5 lines)
●● Medium change (5-20 lines)
●●● Large change (20-50 lines)
●●●● Major change (50+ lines)
✓ Compatible (no changes needed)
```

---

This visual guide should help understand the complete H&E staining implementation architecture and data flow!
