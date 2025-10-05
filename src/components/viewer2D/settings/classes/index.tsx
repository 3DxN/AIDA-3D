import { useState, Dispatch } from 'react'

import Map from 'ol/Map'

import ActiveClassControls from './ActiveClassControls'
import FeatureClass from './FeatureClass'
import FooterToolbar from './FooterToolbar'

// Types
import { FeatureClass as IFeatureClass } from '../../../../types/annotation'

// Manage annotation layers, make adjustments such as opacity, etc.
const Classes = (props: { map: Map }) => {
	const { map } = props

	const [featureClasses, setFeatureClasses]: [
		IFeatureClass[],
		Dispatch<IFeatureClass[]>
	] = useState(map.get('featureClasses') || {})
	const [activeFeatureClass, setActiveFeatureClass]: [
		IFeatureClass,
		Dispatch<IFeatureClass>
	] = useState(map.get('featureClasses')[0])

	return (
		<div>
			{/* Active feature class controls */}
			{activeFeatureClass && (
				<ActiveClassControls
					activeFeatureClass={activeFeatureClass}
					map={map}
				/>
			)}

			{/* Feature classes list */}
			<div className="max-h-40 overflow-y-auto">
				{Object.values(featureClasses).map((featureClass, index) => (
					<FeatureClass
						key={featureClass.id}
						featureClass={featureClass}
						active={activeFeatureClass === featureClass}
						setActiveFeatureClass={setActiveFeatureClass}
						map={map}
					/>
				))}
			</div>

			{/* Footer toolbar */}
			<FooterToolbar map={map} setFeatureClasses={setFeatureClasses} />
		</div>
	)
}

export default Classes
