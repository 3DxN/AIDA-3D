import { useState, useEffect } from 'react'

import Map from 'ol/Map'

import Layer from './Layer'
import ActiveLayerControls from './ActiveLayerControls'
import FooterToolbar from './FooterToolbar'

// Types
import type VectorLayer from 'ol/layer/Vector'
import type VectorSource from 'ol/source/Vector'
import type Geometry from 'ol/geom/Geometry'

// Manage annotation layers, make adjustments such as opacity, etc.
const Layers = (props: { map: Map }) => {
	const { map } = props

	const [layers, setLayers] = useState<VectorLayer<VectorSource<Geometry>>[]>(
		[]
	)
	const [activeLayer, setActiveLayer] = useState(
		map.getLayers().get('activeLayer').layer
	)

	// Get annotation layers from map
	useEffect(() => {
		const layers = map.getLayers()

		// TODO: fix type
		const annotationLayers: any[] = layers
			.getArray()
			.filter((layer) => layer.get('type') === 'annotation')
		setLayers(annotationLayers)

		// Set active layer, add listener to update active layer on change
		setActiveLayer(layers.get('activeLayer').layer)
		const onActiveLayerChange = () => {
			setActiveLayer(layers.get('activeLayer').layer)
		}
		layers.on('propertychange', onActiveLayerChange)

		// Add a listener to update layers state when collection changes
		const onLayersLengthChange = () => {
			const annotationLayers: any[] = layers
				.getArray()
				.filter((layer) => layer.get('type') === 'annotation')
			setLayers(annotationLayers)

			// Update active layer (to the layer above) if the currently active layer
			// was deleted and therefore is no longer in the collection. Without this
			// new features will still be applied to the old layer and not visible.
			if (!layers.getArray().includes(activeLayer)) {
				const index = layers.get('activeLayer').index
				const newActiveLayer = layers.item(index)
				layers.set('activeLayer', { layer: newActiveLayer, index: index })
			}
		}
		layers.on('change:length', onLayersLengthChange)

		// Return a cleanup function to remove the listeners on component unmount
		return () => {
			layers.un('change:length', onLayersLengthChange)
			layers.un('propertychange', onActiveLayerChange)
		}
	}, [map, activeLayer])

	return (
		<div>
			{/* Active layer tab controls */}
			{activeLayer && <ActiveLayerControls activeLayer={activeLayer} />}

			{/* Layers list */}
			<div className="max-h-40 overflow-y-auto">
				{layers.map((layer, index) => (
					<Layer
						key={index}
						layer={layer}
						index={index}
						active={activeLayer === layer}
						map={map}
					/>
				))}
			</div>

			{/* Footer toolbar */}
			<FooterToolbar map={map} />
		</div>
	)
}

export default Layers
