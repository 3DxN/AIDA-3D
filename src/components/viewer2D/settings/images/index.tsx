import { useState, useEffect } from 'react'

import Map from 'ol/Map'

import Layer from './Layer'
import ActiveLayerControls from './ActiveLayerControls'

// Types
import Zoomify from 'ol/source/Zoomify'
import TileLayer from 'ol/layer/Tile'

// Manage images, make adjustments such as opacity, etc.
const Images = (props: { map: Map }) => {
	const { map } = props

	const [images, setImages] = useState<TileLayer<Zoomify>[]>([])
	const [activeImage, setActiveImage] = useState(
		map.getLayers().get('activeImage').image
	)

	// Get image layers from map
	useEffect(() => {
		const layers = map.getLayers()

		// TODO: fix type
		const imageLayers: any[] = layers
			.getArray()
			.filter((layer) => layer.get('type') === 'image')
		setImages(imageLayers)

		// Set active image, add listener to update active layer on change
		setActiveImage(layers.get('activeImage').image)
		const onActiveImageChange = () => {
			setActiveImage(layers.get('activeImage').image)
		}
		layers.on('propertychange', onActiveImageChange)

		// Add a listener to update images state when collection changes
		const onLayersLengthChange = () => {
			const images: any[] = layers
				.getArray()
				.filter((layer) => layer.get('type') === 'image')
			setImages(images)

			// Update active layer (to the layer above) if the currently active layer
			// was deleted and therefore is no longer in the collection. Without this
			// new features will still be applied to the old layer and not visible.
			if (!layers.getArray().includes(activeImage)) {
				const index = layers.get('activeImage').index
				const newActiveLayer = layers.item(index)
				layers.set('activeImage', { layer: newActiveLayer, index: index })
			}
		}
		layers.on('change:length', onLayersLengthChange)

		// Return a cleanup function to remove the listeners on component unmount
		return () => {
			layers.un('change:length', onLayersLengthChange)
			layers.un('propertychange', onActiveImageChange)
		}
	}, [map, activeImage])

	return (
		<div>
			{/* Active image tab controls */}
			{activeImage && <ActiveLayerControls activeLayer={activeImage} />}

			{/* Layers list */}
			<div className="max-h-40 overflow-y-auto">
				{images.map((layer, index) => (
					<Layer
						key={index}
						layer={layer}
						index={index}
						active={activeImage === layer}
						map={map}
					/>
				))}
			</div>
		</div>
	)
}

export default Images
