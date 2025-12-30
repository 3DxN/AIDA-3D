import { useState } from 'react'
import Head from 'next/head'

import ZarrViewer from '../../components/viewer2D/zarr'
import Viewer3D from '../../components/viewer3D'
import StoreLoader from '../../components/loader'
import { useZarrStore } from '../../lib/contexts/ZarrStoreContext'

export default function ZarrWorkspace() {
	const { hasLoadedArray, msInfo } = useZarrStore()

	const [tile, setTile] = useState<[number, number]>([0, 0])
	const [select3D, setSelect3D] = useState(false)
	const [polygonCoords, setPolygonCoords] = useState<number[][][]>([])
	const [showLoader, setShowLoader] = useState(false)

	return (
		<>
			<Head>
				<title>Zarr Viewer - AIDA 3D</title>
			</Head>
			<div className="min-w-full h-screen flex flex-col portrait:flex-col landscape:flex-row bg-gray-100">
				<div className="w-full portrait:w-full landscape:w-1/2 portrait:h-1/2 landscape:h-full relative portrait:border-b landscape:border-b-0 landscape:border-r border-gray-200 overflow-hidden">
					{showLoader ? (
						<StoreLoader onClose={() => setShowLoader(false)} />
					) : (
						<ZarrViewer />
					)}
				</div>
				<div className="w-full portrait:w-full landscape:w-1/2 portrait:h-1/2 landscape:h-full relative overflow-hidden">
					{hasLoadedArray && msInfo ? (
						<Viewer3D
							tile={tile}
							tilesUrl=""
							select3D={select3D}
							setSelect3D={setSelect3D}
							polygonCoords={polygonCoords}
						/>
					) : (
						<div className="flex items-center justify-center h-full text-gray-400">
							3D Viewer
						</div>
					)}
				</div>
			</div>
		</>
	)
}
