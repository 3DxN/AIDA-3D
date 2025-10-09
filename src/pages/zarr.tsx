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
	const {
		source, zarrPath, cellposePath,
		loadStore, loadZarrArray, loadCellposeData, loadFromUrlParams,
		hasLoadedArray, msInfo, isLoading, store, cellposeArray
	} = useZarrStore()

	const [tile, setTile] = useState<[number, number]>([0, 0])
	const [select3D, setSelect3D] = useState(false)
	const [polygonCoords, setPolygonCoords] = useState<number[][][]>([])
	const [showLoader, setShowLoader] = useState(true)
	const [loadedUrlKey, setLoadedUrlKey] = useState<string>('')

	// Auto-load if navigated directly with URL parameters
	useEffect(() => {
		// Wait for router to be ready
		if (!router.isReady) return

		const serverParam = typeof query.server === 'string' ? query.server : null
		const defaultStoreDirParam = typeof query.default_store_dir === 'string' ? query.default_store_dir : null
		const cellposeStoreDirParam = typeof query.cellpose_store_dir === 'string' ? query.cellpose_store_dir : null

		// If we have all URL params, hide loader and load data
		if (serverParam && defaultStoreDirParam && cellposeStoreDirParam) {
			// Create a unique key for this URL combination to prevent duplicate loads
			const urlKey = `${serverParam}|${defaultStoreDirParam}|${cellposeStoreDirParam}`

			if (urlKey === loadedUrlKey) return

			setShowLoader(false)
			setLoadedUrlKey(urlKey)

			// Use the new single-function loader that avoids closure issues
			loadFromUrlParams(serverParam, defaultStoreDirParam, cellposeStoreDirParam)
		}
	}, [router.isReady, query.server, query.default_store_dir, query.cellpose_store_dir, loadedUrlKey, loadFromUrlParams])

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