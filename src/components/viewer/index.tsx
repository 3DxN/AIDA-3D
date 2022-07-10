import { useState } from 'react'

import Viewer2D from '../viewer2D'
import Viewer3D from '../viewer3D'

// Types
import { Annotation } from '../../types/annotation'

const Viewer = (props: {
	imageUrls: string[]
	annotationData: Annotation
	tilesUrl: string
}) => {
	const { imageUrls, annotationData, tilesUrl } = props

	const [tile, setTile] = useState<[number, number]>()
	const [select3D, setSelect3D] = useState(null)
	const [polygonCoords, setPolygonCoords] = useState(null)

	return (
		<div className="min-w-full h-screen flex bg-gray-100">
			<div className="w-1/2 relative">
				<Viewer2D
					imageUrls={imageUrls}
					annotationData={annotationData}
					setTile={setTile}
					select3D={select3D}
					setPolygonCoords={setPolygonCoords}
				/>
			</div>
			<div className="w-1/2 relative">
				<Viewer3D
					tile={tile}
					tilesUrl={tilesUrl}
					setSelect3D={setSelect3D}
					polygonCoords={polygonCoords}
				/>
			</div>
		</div>
	)
}

export default Viewer
