import Viewer from '../components/viewer'
import Head from 'next/head'

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

const Demo = () => {
	// Demo uses example image from GCP bucket
	const imageUrls = [
		'https://storage.googleapis.com/gtl-study-1ase6a/images/marker-demo/HE.dzi',
		'https://storage.googleapis.com/gtl-study-1ase6a/images/marker-demo/CD8.dzi',
		'https://storage.googleapis.com/gtl-study-1ase6a/images/marker-demo/GH2AX.dzi',
	]

	const tilesUrl = `https://storage.googleapis.com/gtl-study-1ase6a/images/marker-demo/Cellpose3DGeometryAndFeatures`

	return (
		<>
			<Head>
				<title>Demo - AIDA 3D</title>
			</Head>
			
			<Viewer
				imageUrls={imageUrls}
				tilesUrl={tilesUrl}
				annotationData={defaultAnnotation}
			/>
		</>
	)
}

export default Demo
