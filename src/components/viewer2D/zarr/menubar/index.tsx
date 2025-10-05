'use client'

import { MenuBar, DropdownMenu } from '../../../interaction/DropdownMenu'
import { useViewer2DData } from '../../../../lib/contexts/Viewer2DDataContext'
import { useZarrStore } from '../../../../lib/contexts/ZarrStoreContext'
import Switch from '../../../interaction/Switch'
import ChannelSelector from '../nav/ChannelSelector'
import ContrastLimitsSelector from '../nav/ContrastLimitsSelector'

export default function ZarrViewerMenuBar() {
  const { msInfo } = useZarrStore()
  const { navigationState, setNavigationState } = useViewer2DData()

  if (!msInfo || !navigationState) {
    return null
  }

  const { channelMap, contrastLimits, cellposeOverlayOn } = navigationState

  const maxContrastLimit = msInfo.dtype === 'uint8' ? 255 : msInfo.dtype === 'uint16' ? 65535 : 1024

  const navigationHandlers = {
    onChannelChange: (role: keyof typeof channelMap, value: number | null) => setNavigationState({
      ...navigationState,
      channelMap: { ...navigationState.channelMap, [role]: value }
    }),
    onContrastLimitsChange: (limits: [number | null, number | null]) => setNavigationState({
      ...navigationState,
      contrastLimits: limits
    }),
    onCellposeOverlayToggle: (newState: boolean) => setNavigationState({
      ...navigationState,
      cellposeOverlayOn: newState
    }),
  }

  return (
    <MenuBar>
      <DropdownMenu label="Overlays">
        <div className="p-3 space-y-2 min-w-[220px]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-800">Cellpose Nuclei</span>
            <Switch
              enabled={cellposeOverlayOn}
              onChange={navigationHandlers.onCellposeOverlayToggle}
            />
          </div>
        </div>
      </DropdownMenu>

      <DropdownMenu label="Channels">
        <div className="p-3 min-w-[280px]">
          <ChannelSelector
            channelNames={msInfo.channels}
            channelMap={channelMap}
            onChannelChange={navigationHandlers.onChannelChange}
          />
        </div>
      </DropdownMenu>

      <DropdownMenu label="Contrast">
        <div className="p-3 min-w-[280px]">
          <ContrastLimitsSelector
            contrastLimitsProps={{
              contrastLimits,
              maxContrastLimit,
              onContrastLimitsChange: navigationHandlers.onContrastLimitsChange
            }}
            channelMap={channelMap}
          />
        </div>
      </DropdownMenu>
    </MenuBar>
  )
}
