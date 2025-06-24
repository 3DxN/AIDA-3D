import { useState, useEffect } from 'react'
import { Disclosure } from '@headlessui/react'

import Map from 'ol/Map'

import Layer from './Layer'
import ActiveLayerControls from './ActiveLayerControls'

import classNames from '../../../../lib/utils/classNames'

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
		<Disclosure className="shadow-sm" as="div">
			{({ open }) => (
				<>
					<Disclosure.Button
						className={classNames(
							'text-gray-700 hover:bg-gray-50 hover:text-gray-900 bg-white group w-full flex items-center pr-2 py-2 text-left text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 relative z-10 ring-inset'
						)}
					>
						<svg
							className={classNames(
								open ? 'text-gray-400 rotate-90' : 'text-gray-300',
								'mr-2 shrink-0 h-5 w-5 group-hover:text-gray-400 transition-colors ease-in-out duration-150'
							)}
							viewBox="0 0 20 20"
							aria-hidden="true"
						>
							<path d="M6 6L14 10L6 14V6Z" fill="currentColor" />
						</svg>
						Images
					</Disclosure.Button>
					<Disclosure.Panel className="bg-white rounded-b-sm">
						{/* Active image tab controls */}
						{activeImage && <ActiveLayerControls activeLayer={activeImage} />}

						{/* Layers list */}

						{/* 
              TODO: if there are many layers in the list such that the active 
                    layer is not visible then on-load we need to scroll the div
                    so the user can see the active layer in the list by default.
            */}
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
					</Disclosure.Panel>
				</>
			)}
		</Disclosure>
	)
}

export default Images
