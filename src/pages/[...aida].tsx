import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

// Components & Hooks
import Viewer from '../components/viewer'
import { ZarrStoreProvider } from '../lib/contexts/ZarrStoreContext'
import { Viewer2DDataProvider } from '../lib/contexts/Viewer2DDataContext'

// Config & Types
import config from '../../aida.config'
import type { Annotation } from '../types/annotation'


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

const AIDA = () => {
	const router = useRouter()
	const { asPath, query } = router

	const [imageUrls, setImageUrls] = useState<string[]>([])
	const [imageName, setImageName] = useState('')
	const [tilesUrl, setTilesUrl] = useState('')

	const [annotationData, setAnnotationData] = useState(defaultAnnotation)
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		setImageName(
			query.aida ? query.aida[query.aida.length - 1] : 'Image not found'
		)
	}, [query, router.isReady])

	useEffect(() => {
		;(async () => {
			if (router.isReady) {
				const defaultDataHost = `http://${window.location.hostname}:${config.server.port}/data`
				const IIIFHost = `http://${window.location.hostname}:${config.IIIF.port}/iiif/2`

				// We assume if the path ends in .json then we are loading an AIDA
				// project which specific image and annotation path as object properties.
				if (asPath.endsWith('.json')) {
					const projectResponse = await fetch(`${defaultDataHost}${asPath}`)

					if (projectResponse.ok) {
						const projectResponseJson = await projectResponse.json()
						const images = projectResponseJson.images

						// Extract image URLs
						for (const image of images) {
							if (image.endsWith('.tiff') || image.endsWith('.tif')) {
								setImageUrls((prev) => [...prev, `${IIIFHost}/${image}`])
							} else {
								setImageUrls((prev) => [...prev, `${defaultDataHost}/${image}`])
							}
						}

						// Extract tiles
						setTilesUrl(`${defaultDataHost}/${projectResponseJson.tiles}`)
					}
				}
				setIsLoading(false)
			}
		})()
	}, [asPath, router.isReady])

	return (
		<>
			<Head>
				<title>{`${imageName} - AIDA 3D`}</title>
			</Head>
			
			{!isLoading && (
				<ZarrStoreProvider>
					<Viewer2DDataProvider>
						<Viewer
							imageUrls={imageUrls}
							tilesUrl={tilesUrl}
							annotationData={annotationData}
						/>
					</Viewer2DDataProvider>
				</ZarrStoreProvider>
			)}
		</>
	)
}

export default AIDA
