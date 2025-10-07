// src/components/viewer3D/BottomPanel.tsx

import { Mesh } from 'three';
import Properties from './settings/Properties';
import PropertyFields from './settings/PropertyFields';
import Export from './settings/Export';
import { WebGLRenderer, Group } from 'three';

export default function BottomPanel(props: {
	renderer: WebGLRenderer;
	content: Group | null;
	featureData: any;
	selected: Mesh[];
	setFeatureData: (data: any) => void;
	globalProperties: any;
	globalPropertyTypes: any;
}) {
	const {
		renderer,
		content,
		featureData,
		selected,
		setFeatureData,
		globalProperties,
		globalPropertyTypes,
	} = props;

	return (
		<div className="bg-white border-t border-gray-200 p-3 flex-shrink-0">
			<div className="flex gap-4 max-w-7xl mx-auto">
				{/* Left side - Buttons */}
				<div className="flex flex-col gap-2 min-w-fit">
					<div className="text-sm font-semibold text-gray-700 mb-2">Properties</div>
					<Properties
						featureData={featureData}
						selected={selected}
						setFeatureData={setFeatureData}
						globalProperties={globalProperties}
						globalPropertyTypes={globalPropertyTypes}
					/>
					<Export
						renderer={renderer}
						content={content}
						globalProperties={globalProperties}
						globalPropertyTypes={globalPropertyTypes}
						setFeatureData={setFeatureData}
					/>
				</div>

				{/* Right side - Property Fields */}
				<PropertyFields
					featureData={featureData}
					selected={selected}
					setFeatureData={setFeatureData}
					globalProperties={globalProperties}
					globalPropertyTypes={globalPropertyTypes}
				/>
			</div>
		</div>
	);
}
