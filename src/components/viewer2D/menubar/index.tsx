import Map from 'ol/Map'
import { MenuBar, DropdownMenu } from '../../interaction/DropdownMenu'
import ToolsMenu from './ToolsMenu'
import Overview from '../settings/overview'
import Images from '../settings/images'
import Layers from '../settings/layers'
import Classes from '../settings/classes'

interface Viewer2DMenuBarProps {
  map: Map
  setTile: (tile: [number, number]) => void
  setPolygonCoords: (coords: any) => void
  select3D: boolean
}

export default function Viewer2DMenuBar({ map, setTile, setPolygonCoords, select3D }: Viewer2DMenuBarProps) {
  return (
    <MenuBar>
      <ToolsMenu map={map} setTile={setTile} setPolygonCoords={setPolygonCoords} select3D={select3D} />

      <DropdownMenu label="Overview">
        <div className="p-2">
          <Overview map={map} />
        </div>
      </DropdownMenu>

      <DropdownMenu label="Images">
        <div className="p-2">
          <Images map={map} />
        </div>
      </DropdownMenu>

      <DropdownMenu label="Layers">
        <div className="p-2">
          <Layers map={map} />
        </div>
      </DropdownMenu>

      <DropdownMenu label="Classes">
        <div className="p-2">
          <Classes map={map} />
        </div>
      </DropdownMenu>
    </MenuBar>
  )
}
