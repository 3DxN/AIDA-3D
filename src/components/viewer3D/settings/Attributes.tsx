// src/components/viewer3D/settings/Attributes.tsx

import { useState, useCallback, Fragment } from 'react';
import { Disclosure, Menu, Transition } from '@headlessui/react';
import NumberField from '../../interaction/NumberField';
import AttributeModal from './AttributeModal';
import { Mesh } from 'three';
import { ChevronDownIcon } from '@heroicons/react/solid';


const MAX_LABELS = 256;

function classNames(...classes: any[]) {
	return classes.filter(Boolean).join(' ');
}

const Attributes = (props: {
	featureData: any;
	selected: Mesh[];
	setFeatureData: (updater: (prevData: any) => any) => void;
	globalAttributes: React.MutableRefObject<
		{ nucleus_index: number;[key: string]: any }[]
	>;
	globalAttributeTypes: React.MutableRefObject<
		{ id: number; name: string; count: number; readOnly: boolean }[]
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
	const [isModalOpen, setIsModalOpen] = useState(false);


	const addAttributeType = useCallback(
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
				globalAttributeTypes.current.push({ id: newId, name: attributeName, count: 0, readOnly: false });

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

	const removeAttributeType = useCallback(
		(attributeName: string) => {
			globalAttributeTypes.current = globalAttributeTypes.current.filter(
				(attr) => attr.name !== attributeName
			);
			globalAttributes.current.forEach((nucleus) => {
				delete nucleus[attributeName];
			});
			setFeatureData((prevData: any) => ({
				...prevData,
				labels: [...globalAttributes.current],
			}));
		},
		[setFeatureData, globalAttributes, globalAttributeTypes]
	);

	const toggleReadOnly = useCallback(
		(attributeName: string) => {
			const attribute = globalAttributeTypes.current.find(
				(attr) => attr.name === attributeName
			);
			if (attribute) {
				attribute.readOnly = !attribute.readOnly;
				setFeatureData((prevData: any) => ({ ...prevData })); // Trigger re-render
			}
		},
		[setFeatureData, globalAttributeTypes]
	);

	const updateLabelValue = useCallback(
		(attributeName: string, value: any) => {
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
						<button
							onClick={() => setIsModalOpen(true)}
							className="w-full bg-pink-500 text-white py-1 px-2 rounded hover:bg-pink-600 text-sm"
						>
							Manage Attribute Types
						</button>
						{attributeError && (
							<div className="mt-2 text-sm text-red-600">{attributeError}</div>
						)}
						<div className="mt-4">
							<div className="text-sm font-medium text-gray-700 mb-2">
								Nucleus Attributes:
							</div>
							<div className="space-y-2">
								{globalAttributeTypes.current.map((attributeType) => (
									<div key={attributeType.id}>
										<div className="flex items-center justify-between">
											<span className="text-sm truncate mr-2">{attributeType.name}</span>
											<div className="w-20">
												<NumberField
													value={getDisplayValue(attributeType.name)}
													onChange={(value) => updateLabelValue(attributeType.name, value)}
													disabled={selected.length === 0 || attributeType.readOnly}
												/>
											</div>
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
					<AttributeModal
						isOpen={isModalOpen}
						onClose={() => setIsModalOpen(false)}
						attributeTypes={globalAttributeTypes.current}
						onAdd={addAttributeType}
						onRemove={removeAttributeType}
						onToggleReadOnly={toggleReadOnly}
					/>
				</>
			)}
		</Disclosure>
	);
};

export default Attributes;