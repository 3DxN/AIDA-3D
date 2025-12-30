import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

import ZarrViewer from '../../components/viewer2D/zarr'
import Viewer3D from '../../components/viewer3D'
import StoreLoader from '../../components/loader'
import { useZarrStore } from '../../lib/contexts/ZarrStoreContext'

// Types
import { Annotation } from '../../types/annotation'

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

export default function ZarrWorkspaceWithUrl() {
	const router = useRouter()
	const { url } = router.query
	const { source, loadStore, hasLoadedArray, msInfo, isLoading, root, navigateToSuggestion } = useZarrStore()

	const [tile, setTile] = useState<[number, number]>([0, 0])
	const [select3D, setSelect3D] = useState(false)
	const [polygonCoords, setPolygonCoords] = useState<number[][][]>([])
	const [showLoader, setShowLoader] = useState(false)
	const [isExampleLoading, setIsExampleLoading] = useState(false)

	// Auto-load zarr store from URL parameter
	useEffect(() => {
		const urlParam = typeof url === 'string' ? decodeURIComponent(url) : null
		if (urlParam && !hasLoadedArray && !isLoading && (!source || source !== urlParam)) {
			// Check if this is the example URL that needs special handling
			if (urlParam === 'http://141.147.64.20:5500/') {
				setIsExampleLoading(true)
			}
			loadStore(urlParam)
		}
	}, [url, hasLoadedArray, isLoading, source, loadStore])

	// Handle example store navigation to '0' subdirectory
	useEffect(() => {
		if (isExampleLoading && root) {
			navigateToSuggestion('0')
			setIsExampleLoading(false)
		}
	}, [root, isExampleLoading, navigateToSuggestion])

	// Hide loader once array is loaded
	useEffect(() => {
		if (hasLoadedArray) {
			setShowLoader(false)
		}
	}, [hasLoadedArray])

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
