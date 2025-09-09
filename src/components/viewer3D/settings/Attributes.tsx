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

const RecursiveAttributeEditor = ({ value, dimensions, attributeName, updateLabelValue, getDisplayValue, path = [], readOnly, selectedLength }: { value: any, dimensions: number[], attributeName: string, updateLabelValue: Function, getDisplayValue: Function, path: number[], readOnly: boolean, selectedLength: number }) => {
	if (!dimensions || dimensions.length === 0) {
		return null;
	}

	const currentDimSize = dimensions[0];
	const nextDimensions = dimensions.slice(1);

	return (
		<div className={`pl-2 ${path.length > 0 ? 'border-l border-gray-200' : ''}`}>
			{Array.from({ length: currentDimSize }).map((_, index) => {
				const newPath = [...path, index];
				if (nextDimensions.length > 0) {
					return (
						<div key={index} className="my-1">
							<div className="text-xs font-medium text-gray-500">Index {index}</div>
							<RecursiveAttributeEditor
								value={value?.[index]}
								dimensions={nextDimensions}
								attributeName={attributeName}
								updateLabelValue={updateLabelValue}
								getDisplayValue={getDisplayValue}
								path={newPath}
								readOnly={readOnly}
								selectedLength={selectedLength}
							/>
						</div>
					);
				} else {
					return (
						<div key={index} className="flex items-center justify-between mt-1">
							<span className="text-xs text-gray-600 mr-2">Index {index}</span>
							<div className="w-20">
								<NumberField
									value={getDisplayValue(attributeName, newPath)}
									onChange={(val) => updateLabelValue(attributeName, val, newPath)}
									disabled={selectedLength !== 1 || readOnly}
								/>
							</div>
						</div>
					);
				}
			})}
		</div>
	);
};

const Attributes = (props: {
	featureData: any;
	selected: Mesh[];
	setFeatureData: (updater: (prevData: any) => any) => void;
	globalAttributes: React.MutableRefObject<
		{ nucleus_index: number;[key: string]: any }[]
	>;
	globalAttributeTypes: React.MutableRefObject<
		{ id: number; name: string; count: number; readOnly: boolean, dimensions?: number[] }[]
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
		(attributeStr: string, dimensionsStr: string) => {
			setLabelError(null);
			const attributeName = attributeStr.trim();
			if (!attributeName) return;

			const dimensions = dimensionsStr.trim() === '' ? [] : dimensionsStr.toLowerCase().split(/[x*]/).map(Number).filter(n => !isNaN(n) && n > 0);

			let attributeType = globalAttributeTypes.current.find(
				(lt) => lt.name === attributeName
			);

			if (!attributeType) {
				if (globalAttributeTypes.current.length >= MAX_LABELS) {
					setLabelError(`Cannot add more than ${MAX_LABELS} label types.`);
					return;
				}
				const newId = globalAttributeTypes.current.length;
				const isMultiDimensional = dimensions.length > 0;

				globalAttributeTypes.current.push({ id: newId, name: attributeName, count: 0, readOnly: false, dimensions: isMultiDimensional ? dimensions : undefined });

				globalAttributes.current.forEach((nucleus) => {
					if (isMultiDimensional) {
						const createNestedArray = (dims: number[]): any => {
							if (dims.length === 1) {
								return Array(dims[0]).fill(0);
							}
							const dim = dims[0];
							const rest = dims.slice(1);
							return Array(dim).fill(0).map(() => createNestedArray(rest));
						};
						nucleus[attributeName] = createNestedArray(dimensions);
					} else {
						nucleus[attributeName] = 0;
					}
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

	const updateAttributeDimensions = useCallback(
		(attributeName: string, dimensions: number[]) => {
			const attribute = globalAttributeTypes.current.find(
				(attr) => attr.name === attributeName
			);
			if (attribute) {
				const isMultiDimensional = dimensions.length > 0;
				attribute.dimensions = isMultiDimensional ? dimensions : undefined;

				globalAttributes.current.forEach((nucleus) => {
					if (isMultiDimensional) {
						const createNestedArray = (dims: number[]): any => {
							if (dims.length === 1) {
								return Array(dims[0]).fill(0);
							}
							const dim = dims[0];
							const rest = dims.slice(1);
							return Array(dim).fill(0).map(() => createNestedArray(rest));
						};
						nucleus[attributeName] = createNestedArray(dimensions);
					} else {
						nucleus[attributeName] = 0;
					}
				});

				setFeatureData((prevData: any) => ({
					...prevData,
					labels: [...globalAttributes.current],
				}));
			}
		},
		[setFeatureData, globalAttributes, globalAttributeTypes]
	);


	const updateLabelValue = useCallback(
		(attributeName: string, value: any, indices?: number[]) => {
			const selectedIndices = new Set(
				selected.map((mesh: THREE.Mesh) => Number(mesh.name.split('_')[1]))
			);

			const newLabels = globalAttributes.current.map((nucleus) => {
				if (selectedIndices.has(nucleus.nucleus_index)) {
					if (indices && indices.length > 0) {
						const newValue = JSON.parse(JSON.stringify(nucleus[attributeName])); // Deep copy
						let current = newValue;
						for (let i = 0; i < indices.length - 1; i++) {
							current = current[indices[i]];
						}
						current[indices[indices.length - 1]] = value;
						return { ...nucleus, [attributeName]: newValue };
					}
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

	const getDisplayValue = (attributeName: string, indices?: number[]) => {
		if (selected.length === 1 && featureData?.labels) {
			const selectedIndex = Number(selected[0].name.split('_')[1]);
			const data = featureData.labels.find(
				(l: any) => l.nucleus_index === selectedIndex
			);

			if (data) {
				if (indices && indices.length > 0) {
					let value = data[attributeName];
					for (const index of indices) {
						if (value && Array.isArray(value)) {
							value = value[index];
						} else {
							return NaN; // Path is invalid
						}
					}
					return typeof value === 'number' ? value : NaN;
				}
				return data[attributeName];
			}
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
										{attributeType.dimensions ? (
											<Menu as="div" className="relative text-left">
												{({ open }) => (
													<>
														<div className="flex items-center justify-between">
															<span className="text-sm truncate mr-2">{attributeType.name}</span>
															<Menu.Button className="inline-flex justify-center w-20 rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-indigo-500" disabled={selected.length === 0 || attributeType.readOnly}>
																Edit
																<ChevronDownIcon
																	className={`${!open ? 'rotate-180' : ''} -mr-1 ml-2 h-5 w-5 transform transition-transform duration-200`}
																	aria-hidden="true"
																/>
															</Menu.Button>
														</div>
														<Transition
															as={Fragment}
															enter="transition ease-out duration-100"
															enterFrom="transform opacity-0 scale-95"
															enterTo="transform opacity-100 scale-100"
															leave="transition ease-in duration-75"
															leaveFrom="transform opacity-100 scale-100"
															leaveTo="transform opacity-0 scale-95"
														>
															<Menu.Items static className="mt-2 w-full rounded-md shadow-lg bg-gray-50 ring-1 ring-black ring-opacity-5 focus:outline-none max-h-48 overflow-y-auto">
																<div className="p-2">
																	<RecursiveAttributeEditor
																		value={getDisplayValue(attributeType.name)}
																		dimensions={attributeType.dimensions}
																		attributeName={attributeType.name}
																		updateLabelValue={updateLabelValue}
																		getDisplayValue={getDisplayValue}
																		readOnly={attributeType.readOnly}
																		selectedLength={selected.length}
																	/>
																</div>
															</Menu.Items>
														</Transition>
													</>
												)}
											</Menu>
										) : (
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
										)}
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
						onUpdateDimensions={updateAttributeDimensions}
					/>
				</>
			)}
		</Disclosure>
	);
};

export default Attributes;
