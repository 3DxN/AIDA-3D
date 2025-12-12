import { useEffect, useState } from 'react'

import Map from 'ol/Map'
import View from 'ol/View'
import Zoomify from 'ol/source/Zoomify'
import TileLayer from 'ol/layer/Tile'
import VectorSource from 'ol/source/Vector'
import VectorLayer from 'ol/layer/Vector'
import IIIF from 'ol/source/IIIF'
import IIIFInfo from 'ol/format/IIIFInfo'
import Polygon from 'ol/geom/Polygon'
import Feature from 'ol/Feature'
import Style from 'ol/style/Style'
import Fill from 'ol/style/Fill'
import Stroke from 'ol/style/Stroke'

import { parseDzi } from '../../lib/utils/parseDzi'
import parseFeature from '../../lib/utils/parseFeature'

import Toolbar from './toolbar'
import MapView from './MapView'
import Settings from './settings'

// Types
import { Annotation } from '../../types/annotation'

const Viewer = (props: {
	imageUrls: string[]
	annotationData: Annotation
	setTile: (tile: [number, number]) => void
	setPolygonCoords: (coords: [number, number][]) => void
	select3D: boolean
}) => {
	const { imageUrls, annotationData, setTile, setPolygonCoords, select3D } =
		props

	const [map, setMap] = useState<Map>()

	// Instantiate map object here so all child components will all have access
	// via props. Annoyingly, we can only create our Map object once the page has
	// rendered. This is because openLayers expects to have access to the document
	// object. Hence, we use useEffect to wait until the page has loaded.
	// Setup the map, image layer and source based on provided URL
	// At the moment we expect the URL to be a .dzi file.
	useEffect(() => {
		;(async () => {
			const map = new Map({ controls: [] })
			let imageWidth = 0
			let imageHeight = 0

			const baseImageUrl = imageUrls[0]
			const baseImageExt = baseImageUrl.split('.').pop()
			const baseImageName = baseImageUrl.split('/').pop()

			// IMAGE LAYER -----------------------------------------------------------
			if (baseImageExt === 'dzi') {
				const response = await fetch(baseImageUrl)
				const dzi = await parseDzi(await response.text())

				imageHeight = dzi.size.height
				imageWidth = dzi.size.width

				const baseUrl = baseImageUrl.substring(0, baseImageUrl.lastIndexOf('.'))
				const templateUrl = `${baseUrl}_files/{z}/{x}_{y}.${dzi.format}`
				const tileSource = new Zoomify({
					url: templateUrl,
					size: [dzi.size.width, dzi.size.height],
					tileSize: dzi.tileSize,
				})

				// We're using the Zoomify source but .dzi will have an offset that we
				// need to account for.
				const offset = Math.ceil(Math.log(dzi.tileSize) / Math.LN2)

				// The Zoomify source we are using expects a {TileGroup} variable. We
				// are adapting it to work with .dzi by adjusting the setTileUrlFunction.
				// However, there will be a single 404 request. This is because the
				// tileSource has already attempted to load before we can specify the
				// following TileUrlFunction. A shame this can't be provided to the
				// Zoomify source constructor at initialisation time.
				tileSource.setTileUrlFunction((tileCoord) => {
					return templateUrl
						.replace('{z}', (tileCoord[0] + offset).toString())
						.replace('{x}', tileCoord[1].toString())
						.replace('{y}', tileCoord[2].toString())
				})

				const tileLayer = new TileLayer({ source: tileSource })
				tileLayer.set('id', baseImageName)
				tileLayer.set('type', 'image')
				map.addLayer(tileLayer)

				map.getLayers().set('activeImage', { image: tileLayer, index: 0 })

				// VIEW ----------------------------------------------------------------
				const view = new View({
					resolutions: tileSource.getTileGrid()?.getResolutions(),
					extent: tileSource.getTileGrid()?.getExtent(),
					showFullExtent: true,
				})
				map.setView(view)
				const tileGrid = tileSource.getTileGrid()
				if (tileGrid) {
					view.fit(tileGrid.getExtent())
				}
			}
			// Otherwise, we assume we're dealing with a IIIF image server.
			// Likely .tiff.
			else {
				// Fetch info.json
				const infoResponse = await fetch(`${baseImageUrl}/info.json`)
				const info = await infoResponse.json()

				imageWidth = info.width
				imageHeight = info.height

				const options = new IIIFInfo(info).getTileSourceOptions()
				if (options === undefined || options.version === undefined) {
					throw new Error('Unable to parse IIIF info.json')
				}

				const iiifTileSource = new IIIF(options)

				const tileLayer = new TileLayer({ source: iiifTileSource })
				tileLayer.set('id', 'image')
				tileLayer.set('type', 'image')
				map.addLayer(tileLayer)

				// VIEW ----------------------------------------------------------------
				const view = new View({
					center: [info.width / 2, info.height / 2],
					resolutions: iiifTileSource.getTileGrid()?.getResolutions(),
					extent: iiifTileSource.getTileGrid()?.getExtent(),
					showFullExtent: true,
				})
				map.setView(view)
				const tileGrid = iiifTileSource.getTileGrid()
				if (tileGrid) {
					view.fit(tileGrid.getExtent())
				}
			}

			// IMAGE LAYERS ----------------------------------------------------------
			// For the remaining images, we need to create a new layer and source for
			// each.
			for (let i = 1; i < imageUrls.length; i++) {
				const imageUrl = imageUrls[i]
				const imageExt = imageUrl.split('.').pop()
				const imageName = imageUrl.split('/').pop()

				if (imageExt === 'dzi') {
					const response = await fetch(imageUrl)
					const dzi = await parseDzi(await response.text())

					const baseUrl = imageUrl.substring(0, imageUrl.lastIndexOf('.'))
					const templateUrl = `${baseUrl}_files/{z}/{x}_{y}.${dzi.format}`
					const tileSource = new Zoomify({
						url: templateUrl,
						size: [dzi.size.width, dzi.size.height],
						tileSize: dzi.tileSize,
					})

					const offset = Math.ceil(Math.log(dzi.tileSize) / Math.LN2)

					// Use an IIFE to create a new TileUrlFunction for each layer so that
					// the templateURL is evaluated immediately and therefore static in
					// subsequent calls.
					const tileUrlFunction = (() => {
						const template = templateUrl
						return (tileCoord: number[]) => {
							return template
								.replace('{z}', (tileCoord[0] + offset).toString())
								.replace('{x}', tileCoord[1].toString())
								.replace('{y}', tileCoord[2].toString())
						}
					})()

					tileSource.setTileUrlFunction(tileUrlFunction)

					const tileLayer = new TileLayer({ source: tileSource })
					tileLayer.set('id', imageName)
					tileLayer.set('type', 'image')
					map.addLayer(tileLayer)
				} else {
					const infoResponse = await fetch(`${imageUrl}/info.json`)
					const info = await infoResponse.json()

					imageWidth = info.width
					imageHeight = info.height

					const options = new IIIFInfo(info).getTileSourceOptions()
					if (options === undefined || options.version === undefined) {
						throw new Error('Unable to parse IIIF info.json')
					}

					const iiifTileSource = new IIIF(options)

					const tileLayer = new TileLayer({ source: iiifTileSource })
					tileLayer.set('id', `image-${i}`)
					tileLayer.set('type', 'image')
					map.addLayer(tileLayer)
				}
			}

			// ANNOTATION LAYER ------------------------------------------------------

			// Listener for each vectorSource that set a property on the map when
			// there are unsaved changes to the vector source.
			const unsavedChangesListener = () => {
				map.set('unsavedChanges', true)
			}

			// Draw grid of polygons. Each represents a tile int he corresponding 3D
			// viewer. The grid enables the user to select a 3D subsection to display.
			const vectorSource = new VectorSource({ wrapX: false })
			const vectorLayer = new VectorLayer({ source: vectorSource })
			vectorLayer.set('id', 'grid')
			vectorLayer.set('type', 'grid')
			map.addLayer(vectorLayer)

			// TODO: dynamically set this tileSize from either user input of a
			//			 configuration file.
			const gutter = 25
			const tileSize = 682 // Value in original demo: 302
			const overlap = 0
			const gridSize = tileSize - overlap
			const cols = Math.floor(imageWidth / tileSize)
			const rows = Math.floor(imageHeight / tileSize)

			// Create an interactive grid of polygons.
			for (let i = 0; i < cols; i++) {
				for (let j = 0; j < rows; j++) {
					let x1 = i * gridSize + overlap + (i + 1) * gutter
					let y1 = -j * gridSize - overlap - (j + 1) * gutter
					let x2 = (i + 1) * gridSize + overlap + (i + 1) * gutter
					let y2 = -(j + 1) * gridSize - overlap - (j + 1) * gutter

					// Handle first and last row/col
					if (i === 0) {
						x1 = 0 + gutter
						x2 = tileSize + gutter
					} else if (i === cols) {
						x2 = imageWidth - gutter
					}

					if (j === 0) {
						y1 = 0 - gutter
						y2 = -tileSize - gutter
					} else if (j === rows) {
						y2 = -imageHeight + gutter
					}

					const polygon = new Polygon([
						[
							[x1, y1],
							[x2, y1],
							[x2, y2],
							[x1, y2],
							[x1, y1],
						],
					])

					const feature = new Feature(polygon)
					feature.setStyle(
						new Style({
							fill: new Fill({
								color: 'rgba(255, 255, 255, 0)',
							}),
							stroke: new Stroke({
								color: '#3399CC',
								width: 1,
							}),
						})
					)
					feature.set('id', `grid-${i}-${j}`)
					feature.set('row', j)
					feature.set('col', i)

					// TODO: check why the 3D model is reflected. This is potentially
					//       something strange with the way the 3D demo data was prepared.
					feature.set('3D-row', j) 
					feature.set('3D-col', i)

					vectorSource.addFeature(feature)
				}
			}

			// Import annotation data into the map.
			for (const layer of annotationData.layers) {
				const vectorSource = new VectorSource({ wrapX: false })
				const vectorLayer = new VectorLayer({ source: vectorSource })
				vectorLayer.set('id', layer.id)
				vectorLayer.set('type', 'annotation')
				map.addLayer(vectorLayer)

				const featuresToDraw = layer.features.map((feature) =>
					parseFeature(feature, annotationData.classes)
				)

				vectorSource.addFeatures(featuresToDraw)

				vectorSource.on(
					['addfeature', 'changefeature', 'removefeature'],
					unsavedChangesListener
				)
			}

			map.set('featureClasses', annotationData.classes)
			map.set('activeFeatureClass', 0)

			// Set first layer as active layer
			const firstLayer = map
				.getLayers()
				.getArray()
				.filter((layer) => layer.get('type') === 'annotation')[0]
			map.getLayers().set('activeLayer', { layer: firstLayer, index: 0 })

			setMap(map)

			// Cleanup function
			return () => {
				// Remove unsaved changes listener
				map.getLayers().forEach((layer) => {
					if (layer instanceof VectorLayer) {
						layer
							.getSource()
							.un(
								['addfeature', 'changefeature', 'removefeature'],
								unsavedChangesListener
							)
					}
				})
			}
		})()
	}, [imageUrls, annotationData.classes, annotationData.layers])

	return (
		<div className="min-w-full min-h-screen flex bg-gray-100">
			{/* Toolbar */}
			{map && (
				<Toolbar
					map={map}
					setTile={setTile}
					setPolygonCoords={setPolygonCoords}
					select3D={select3D}
				/>
			)}

			{/* Image view */}
			{map && <MapView map={map} />}

			{/* Right settings sidebar */}
			{map && <Settings map={map} />}
		</div>
	)
}

export default Viewer
