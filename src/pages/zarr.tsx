import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

import ZarrViewer from '../components/viewer2D/zarr'
import Viewer3D from '../components/viewer3D'
import StoreLoader from '../components/loader' // Make sure this is imported
import { useZarrStore } from '../lib/contexts/ZarrStoreContext'

// Types
import { Annotation } from '../types/annotation'

// Initial default template for new annotation data
const defaultAnnotation: Annotation = {
	header: {
		schemaVersion: '2.0',
		timestamp: Date.now(),
	},
	layers: [
		{
			id: 'Layer 1',
			features: [],
		},
	],
	classes: [
		{
			id: 0,
			name: 'Default class',
			style: {
				stroke: {
					color: [51, 153, 204, 1],
					width: 1.25,
				},
				fill: {
					color: [255, 255, 255, 0.4],
				},
			},
		},
	],
}

export default function ZarrWorkspace() {
	const router = useRouter()
	const { query } = router
	const { source, loadStore, hasLoadedArray, msInfo, isLoading } = useZarrStore()

	const [tile, setTile] = useState<[number, number]>([0, 0])
	const [select3D, setSelect3D] = useState(false)
	const [polygonCoords, setPolygonCoords] = useState<number[][][]>([])
	const [showLoader, setShowLoader] = useState(true); // This state is new

	// Auto-load if navigated directly with ?src=
	useEffect(() => {
		const srcParam = typeof query.src === 'string' ? query.src : null
		if (srcParam && !hasLoadedArray && !isLoading && (!source || source !== srcParam)) {
			loadStore(srcParam)
		}
	}, [query.src, hasLoadedArray, isLoading, source, loadStore])

	// This useEffect hook is also new
	useEffect(() => {
		if (hasLoadedArray) {
			setShowLoader(false);
		}
	}, [hasLoadedArray]);

	// src/pages/zarr.tsx

	return (
		<>
			<Head>
				<title>Zarr Viewer - AIDA 3D</title>
			</Head>
			<div className="min-w-full h-screen flex flex-col portrait:flex-col landscape:flex-row bg-gray-100">
				<div className="w-full portrait:w-full landscape:w-1/2 portrait:h-1/2 landscape:h-full relative border-r border-gray-200">
					{showLoader ? (
						<StoreLoader onClose={() => setShowLoader(false)} />
					) : hasLoadedArray && msInfo ? (
						<ZarrViewer />
					) : (
						<div className="flex items-center justify-center h-full text-gray-500">
							{isLoading ? (
								<div className="text-center">
									<div className="text-lg mb-2">Loading Zarr store...</div>
									<div className="text-sm">Please wait while we load your data</div>
								</div>
							) : (
								<div className="text-center">
									<div className="text-lg mb-2">Waiting for Zarr data...</div>
									<div className="text-sm">You can open the loader again to select a Zarr store.</div>
								</div>
							)}
						</div>
					)}
				</div>
				<div className="w-full portrait:w-full landscape:w-1/2 portrait:h-1/2 landscape:h-full relative">
					{hasLoadedArray && msInfo ? (
						<Viewer3D
							tile={tile}
							tilesUrl=""
							select3D={select3D}
							setSelect3D={setSelect3D}
							polygonCoords={polygonCoords}
						/>
					) : (
						// Optional: You can add a placeholder for the 3D viewer as well
						<div className="flex items-center justify-center h-full text-gray-400">
							3D Viewer
						</div>
					)}
				</div>
			</div>
		</>
	);
}