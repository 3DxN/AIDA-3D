import Map from 'ol/Map'
import Overview from './settings/overview'
import Images from './settings/images'
import Layers from './settings/layers'
import Classes from './settings/classes'

interface BottomPanelProps {
  map: Map
}

export default function BottomPanel({ map }: BottomPanelProps) {
  return (
    <div className="bg-white border-t border-gray-200 p-3 flex-shrink-0">
      <div className="flex gap-6 max-w-7xl mx-auto overflow-x-auto">
        {/* Overview Section */}
        <div className="flex flex-col gap-2 min-w-fit">
          <div className="text-sm font-semibold text-gray-700">Overview</div>
          <Overview map={map} />
        </div>

        {/* Images Section */}
        <div className="flex flex-col gap-2 min-w-[200px]">
          <div className="text-sm font-semibold text-gray-700">Images</div>
          <Images map={map} />
        </div>

        {/* Layers Section */}
        <div className="flex flex-col gap-2 min-w-[200px]">
          <div className="text-sm font-semibold text-gray-700">Layers</div>
          <Layers map={map} />
        </div>

        {/* Classes Section */}
        <div className="flex flex-col gap-2 min-w-[200px]">
          <div className="text-sm font-semibold text-gray-700">Classes</div>
          <Classes map={map} />
        </div>
      </div>
    </div>
  )
}
