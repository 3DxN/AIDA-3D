import { useState, useEffect, useRef } from 'react'

import Map from 'ol/Map'
import OverviewMap from 'ol/control/OverviewMap'
import TileLayer from 'ol/layer/Tile'
import Zoomify from 'ol/source/Zoomify'

function classNames(...classes: string[]) {
	return classes.filter(Boolean).join(' ')
}

// Overview shows a high-level overview of the map, indicating the current size
// and position of the viewport.
const Overview = (props: { map: Map }) => {
	const { map } = props

	const overviewEl = useRef(null)

	useEffect(() => {
		const imageLayers = map
			.getLayers()
			.getArray()
			.filter((layer) => layer.get('type') === 'image') as TileLayer<Zoomify>[]

		// Create matching layers for each source
		const overviewLayers = imageLayers.map(
			(layer) => new TileLayer({ source: layer.getSource() })
		)

		const overview = new OverviewMap({
			className: 'overview ol-overviewmap',
			collapsible: false,
			layers: overviewLayers,
			target: overviewEl.current || undefined,
		})
		map.addControl(overview)
	}, [map])

	return (
		<div ref={overviewEl} className="h-32" />
	)
}

export default Overview
