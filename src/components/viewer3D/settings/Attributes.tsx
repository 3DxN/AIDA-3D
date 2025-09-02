// src/components/viewer3D/settings/Attributes.tsx

import { useState, useEffect, useCallback } from 'react';
import { Disclosure } from '@headlessui/react';
import Input from '../../interaction/Input';
import NumberField from '../../interaction/NumberField';
import { Mesh } from 'three';

const MAX_LABELS = 256;

function classNames(...classes: any[]) {
	return classes.filter(Boolean).join(' ');
}

const Attributes = (props: {
	featureData: any;
	selected: Mesh[];
	setFeatureData: (updater: (prevData: any) => any) => void;
	globalAttributes: React.MutableRefObject<
		{ nucleus_index: number;[key: string]: number }[]
	>;
	globalAttributeTypes: React.MutableRefObject<
		{ id: number; name: string; count: number }[]
	>;
}) => {
	const {
		featureData,
		selected,
		setFeatureData,
		globalAttributes,
		globalAttributeTypes,
	} = props;

	const [attributeError, setLabelError] = useState<string | null>(null);

	const commitInput = useCallback(
		(attributeStr: string) => {
			setLabelError(null);
			const attributeName = attributeStr.trim();
			if (!attributeName) return;

			let attributeType = globalAttributeTypes.current.find(
				(lt) => lt.name === attributeName
			);

			if (!attributeType) {
				if (globalAttributeTypes.current.length >= MAX_LABELS) {
					setLabelError(`Cannot add more than ${MAX_LABELS} label types.`);
					return;
				}
				const newId = globalAttributeTypes.current.length;
				globalAttributeTypes.current.push({ id: newId, name: attributeName, count: 0 });

				globalAttributes.current.forEach((nucleus) => {
					nucleus[attributeName] = 0;
				});
			}

			setFeatureData((prevData: any) => ({
				...prevData,
				labels: [...globalAttributes.current],
			}));
		},
		[setFeatureData, globalAttributes, globalAttributeTypes]
	);

	const updateLabelValue = useCallback(
		(attributeName: string, value: number) => {
			const selectedIndices = new Set(
				selected.map((mesh: THREE.Mesh) => Number(mesh.name.split('_')[1]))
			);

			const newLabels = globalAttributes.current.map((nucleus) => {
				if (selectedIndices.has(nucleus.nucleus_index)) {
					return {
						...nucleus,
						[attributeName]: value,
					};
				}
				return nucleus;
			});

			globalAttributes.current = newLabels;

			setFeatureData((prevData: any) => ({
				...prevData,
				labels: newLabels,
			}));
		},
		[selected, setFeatureData, globalAttributes]
	);

	const getDisplayValue = (attributeName: string) => {
		if (selected.length === 1 && featureData?.labels) {
			const selectedIndex = Number(selected[0].name.split('_')[1]);
			const data = featureData.labels.find(
				(l: any) => l.nucleus_index === selectedIndex
			);
			return data ? data[attributeName] : NaN;
		}
		return NaN;
	};

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
						Attributes
					</Disclosure.Button>
					<Disclosure.Panel className="relative px-4 py-2 w-48">
						<div>
							<Input
								commitInput={commitInput}
								label={'Add attribute type'}
								placeholder="New attribute name"
							/>
						</div>
						{attributeError && (
							<div className="mt-2 text-sm text-red-600">{attributeError}</div>
						)}
						<div className="mt-4">
							<div className="text-sm font-medium text-gray-700 mb-2">
								Nucleus Attributes:
							</div>
							<div className="max-h-40 overflow-y-auto space-y-2">
								{globalAttributeTypes.current.map((attributeType) => (
									<div key={attributeType.id} className="flex items-center justify-between">
										<span className="text-sm truncate mr-2">{attributeType.name}</span>
										<div className="w-20">
											<NumberField
												value={getDisplayValue(attributeType.name)}
												onChange={(value) => updateLabelValue(attributeType.name, value)}
												disabled={selected.length === 0}
											/>
										</div>
									</div>
								))}
							</div>
							{selected.length === 0 && (
								<div className="text-sm text-gray-500 mt-2">
									Select a nucleus to edit its attributes.
								</div>
							)}
						</div>
					</Disclosure.Panel>
				</>
			)}
		</Disclosure>
	);
};

export default Attributes;