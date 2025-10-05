import { WebGLRenderer, Scene, Camera, Group } from 'three'
import { MenuBar, DropdownMenu } from '../../interaction/DropdownMenu'
import Clipping from '../settings/Clipping'
import Explode from '../settings/Explode'
import ColorMap from '../settings/colorMaps'
import Filter from '../settings/Filter'
import Orientation from '../settings/Orientation'

interface Viewer3DMenuBarProps {
  renderer: WebGLRenderer
  scene: Scene
  camera: Camera
  content: Group
  featureData: any
  selected: any[]
  setFeatureData: (data: any) => void
  globalProperties: any
  globalPropertyTypes: any
  filterIncompleteNuclei: boolean
  setFilterIncompleteNuclei: (value: boolean) => void
}

export default function Viewer3DMenuBar({
  renderer,
  scene,
  camera,
  content,
  featureData,
  selected,
  setFeatureData,
  globalProperties,
  globalPropertyTypes,
  filterIncompleteNuclei,
  setFilterIncompleteNuclei,
}: Viewer3DMenuBarProps) {
  return (
    <MenuBar>
      <DropdownMenu label="Clipping">
        <div className="p-2">
          <Clipping renderer={renderer} scene={scene} camera={camera} />
        </div>
      </DropdownMenu>

      <DropdownMenu label="Explode">
        <div className="p-2">
          <Explode
            renderer={renderer}
            scene={scene}
            camera={camera}
            content={content}
          />
        </div>
      </DropdownMenu>

      <DropdownMenu label="Color Map">
        <div className="p-2">
          <ColorMap
            renderer={renderer}
            scene={scene}
            camera={camera}
            content={content}
            featureData={featureData}
            globalProperties={globalProperties}
            globalPropertyTypes={globalPropertyTypes}
          />
        </div>
      </DropdownMenu>

      <DropdownMenu label="Filter">
        <div className="p-2">
          <Filter
            renderer={renderer}
            scene={scene}
            camera={camera}
            content={content}
            featureData={featureData}
            selected={selected}
            globalProperties={globalProperties}
            globalPropertyTypes={globalPropertyTypes}
            filterIncompleteNuclei={filterIncompleteNuclei}
            setFilterIncompleteNuclei={setFilterIncompleteNuclei}
          />
        </div>
      </DropdownMenu>

      <DropdownMenu label="Orientation">
        <div className="p-2">
          <Orientation
            renderer={renderer}
            scene={scene}
            camera={camera}
            content={content}
            featureData={featureData}
          />
        </div>
      </DropdownMenu>
    </MenuBar>
  )
}
