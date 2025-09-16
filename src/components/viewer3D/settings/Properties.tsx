import { useState, useCallback, Fragment } from 'react';
import { Disclosure, Menu, Transition } from '@headlessui/react';
import NumberField from '../../interaction/NumberField';
import PropertyModal from './PropertyModal';
import { Mesh } from 'three';
import { ChevronDownIcon } from '@heroicons/react/solid';


const MAX_LABELS = 256;

function classNames(...classes: any[]) {
	return classes.filter(Boolean).join(' ');
}

const RecursivePropertyEditor = ({ value, dimensions, propertyName, updateLabelValue, getDisplayValue, path = [], readOnly, selectedLength }: { value: any, dimensions: number[], propertyName: string, updateLabelValue: Function, getDisplayValue: Function, path: number[], readOnly: boolean, selectedLength: number }) => {
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
							<RecursivePropertyEditor
								value={value?.[index]}
								dimensions={nextDimensions}
								propertyName={propertyName}
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
									value={getDisplayValue(propertyName, newPath)}
									onChange={(val) => updateLabelValue(propertyName, val, newPath)}
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

const Properties = (props: {
	featureData: any;
	selected: Mesh[];
	setFeatureData: (updater: (prevData: any) => any) => void;
	globalProperties: React.MutableRefObject<
		{ nucleus_index: number;[key: string]: any }[]
	>;
	globalPropertyTypes: React.MutableRefObject<
		{ id: number; name: string; count: number; readOnly: boolean, dimensions?: number[] }[]
	>;
}) => {
	const {
		featureData,
		selected,
		setFeatureData,
		globalProperties,
		globalPropertyTypes,
	} = props;

	const [propertyError, setLabelError] = useState<string | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);


	const addPropertyType = useCallback(
		(propertyStr: string, dimensionsStr: string) => {
			setLabelError(null);
			const propertyName = propertyStr.trim();
			if (!propertyName) return;

			const dimensions = dimensionsStr.trim() === '' ? [] : dimensionsStr.toLowerCase().split(/[x*]/).map(Number).filter(n => !isNaN(n) && n > 0);

			let propertyType = globalPropertyTypes.current.find(
				(lt) => lt.name === propertyName
			);

			if (!propertyType) {
				if (globalPropertyTypes.current.length >= MAX_LABELS) {
					setLabelError(`Cannot add more than ${MAX_LABELS} label types.`);
					return;
				}
				const newId = globalPropertyTypes.current.length;
				const isMultiDimensional = dimensions.length > 0;

				globalPropertyTypes.current.push({ id: newId, name: propertyName, count: 0, readOnly: false, dimensions: isMultiDimensional ? dimensions : undefined });

				globalProperties.current.forEach((nucleus) => {
					if (isMultiDimensional) {
						const createNestedArray = (dims: number[]): any => {
							if (dims.length === 1) {
								return Array(dims[0]).fill(0);
							}
							const dim = dims[0];
							const rest = dims.slice(1);
							return Array(dim).fill(0).map(() => createNestedArray(rest));
						};
						nucleus[propertyName] = createNestedArray(dimensions);
					} else {
						nucleus[propertyName] = 0;
					}
				});
			}

			setFeatureData((prevData: any) => ({
				...prevData,
				labels: [...globalProperties.current],
			}));
		},
		[setFeatureData, globalProperties, globalPropertyTypes]
	);

	const removePropertyType = useCallback(
		(propertyName: string) => {
			globalPropertyTypes.current = globalPropertyTypes.current.filter(
				(attr) => attr.name !== propertyName
			);
			globalProperties.current.forEach((nucleus) => {
				delete nucleus[propertyName];
			});
			setFeatureData((prevData: any) => ({
				...prevData,
				labels: [...globalProperties.current],
			}));
		},
		[setFeatureData, globalProperties, globalPropertyTypes]
	);

	const toggleReadOnly = useCallback(
		(propertyName: string) => {
			const property = globalPropertyTypes.current.find(
				(attr) => attr.name === propertyName
			);
			if (property) {
				property.readOnly = !property.readOnly;
				setFeatureData((prevData: any) => ({ ...prevData })); // Trigger re-render
			}
		},
		[setFeatureData, globalPropertyTypes]
	);

	const updatePropertyDimensions = useCallback(
		(propertyName: string, dimensions: number[]) => {
			const property = globalPropertyTypes.current.find(
				(attr) => attr.name === propertyName
			);
			if (property) {
				const isMultiDimensional = dimensions.length > 0;
				property.dimensions = isMultiDimensional ? dimensions : undefined;

				globalProperties.current.forEach((nucleus) => {
					if (isMultiDimensional) {
						const createNestedArray = (dims: number[]): any => {
							if (dims.length === 1) {
								return Array(dims[0]).fill(0);
							}
							const dim = dims[0];
							const rest = dims.slice(1);
							return Array(dim).fill(0).map(() => createNestedArray(rest));
						};
						nucleus[propertyName] = createNestedArray(dimensions);
					} else {
						nucleus[propertyName] = 0;
					}
				});

				setFeatureData((prevData: any) => ({
					...prevData,
					labels: [...globalProperties.current],
				}));
			}
		},
		[setFeatureData, globalProperties, globalPropertyTypes]
	);


	const updateLabelValue = useCallback(
		(propertyName: string, value: any, indices?: number[]) => {
			const selectedIndices = new Set(
				selected.map((mesh: THREE.Mesh) => Number(mesh.name.split('_')[1]))
			);

			const newLabels = globalProperties.current.map((nucleus) => {
				if (selectedIndices.has(nucleus.nucleus_index)) {
					if (indices && indices.length > 0) {
						const newValue = JSON.parse(JSON.stringify(nucleus[propertyName])); // Deep copy
						let current = newValue;
						for (let i = 0; i < indices.length - 1; i++) {
							current = current[indices[i]];
						}
						current[indices[indices.length - 1]] = value;
						return { ...nucleus, [propertyName]: newValue };
					}
					return {
						...nucleus,
						[propertyName]: value,
					};
				}
				return nucleus;
			});

			globalProperties.current = newLabels;

			setFeatureData((prevData: any) => ({
				...prevData,
				labels: newLabels,
			}));
		},
		[selected, setFeatureData, globalProperties]
	);

	const getDisplayValue = (propertyName: string, indices?: number[]) => {
		if (selected.length === 1 && featureData?.labels) {
			const selectedIndex = Number(selected[0].name.split('_')[1]);
			const data = featureData.labels.find(
				(l: any) => l.nucleus_index === selectedIndex
			);

			if (data) {
				if (indices && indices.length > 0) {
					let value = data[propertyName];
					for (const index of indices) {
						if (value && Array.isArray(value)) {
							value = value[index];
						} else {
							return 0; // Return 0 instead of NaN for better UX
						}
					}
					return typeof value === 'number' ? value : 0;
				}
				return typeof data[propertyName] === 'number' ? data[propertyName] : 0;
			}
		}
		return 0; // Return 0 instead of NaN when no single nucleus is selected
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
						Properties
					</Disclosure.Button>
					<Disclosure.Panel className="relative px-4 py-2 w-48">
						<button
							onClick={() => setIsModalOpen(true)}
							className="w-full bg-pink-500 text-white py-1 px-2 rounded hover:bg-pink-600 text-sm"
						>
							Manage Property Types
						</button>
						{propertyError && (
							<div className="mt-2 text-sm text-red-600">{propertyError}</div>
						)}
						<div className="mt-4">
							{selected.length === 0 ? (
								<div className="text-sm text-gray-500 mb-2">
									Select a nucleus to edit properties.
								</div>
							) : selected.length > 1 ? (
								<div className="text-sm text-gray-500 mb-2">
									Select exactly one nucleus to edit properties. ({selected.length} selected)
								</div>
							) : (
								<div className="text-sm font-medium text-gray-700 mb-2">
									Nucleus Properties:
								</div>
							)}
							<div className="space-y-2">
								{globalPropertyTypes.current.map((propertyType) => (
									<div key={propertyType.id}>
										{propertyType.dimensions ? (
											<Menu as="div" className="relative text-left">
												{({ open }) => (
													<>
														<div className="flex items-center justify-between">
															<span className="text-sm truncate mr-2">
																{propertyType.name}
																{propertyType.readOnly && (
																	<span className="ml-1 text-xs text-gray-400">(read-only)</span>
																)}
															</span>
															<Menu.Button
																className="inline-flex justify-center w-20 rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
																disabled={selected.length === 0}
															>
																View
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
																	<RecursivePropertyEditor
																		value={getDisplayValue(propertyType.name)}
																		dimensions={propertyType.dimensions}
																		propertyName={propertyType.name}
																		updateLabelValue={updateLabelValue}
																		getDisplayValue={getDisplayValue}
																		readOnly={propertyType.readOnly}
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
												<span className="text-sm truncate mr-2">
													{propertyType.name}
													{propertyType.readOnly && (
														<span className="ml-1 text-xs text-gray-400">(read-only)</span>
													)}
												</span>
												<div className="w-20">
													<NumberField
														value={getDisplayValue(propertyType.name)}
														onChange={(value) => updateLabelValue(propertyType.name, value)}
														disabled={selected.length !== 1 || propertyType.readOnly}
													/>
												</div>
											</div>
										)}
									</div>
								))}
							</div>
						</div>
					</Disclosure.Panel>
					<PropertyModal
						isOpen={isModalOpen}
						onClose={() => setIsModalOpen(false)}
						propertyTypes={globalPropertyTypes.current}
						onAdd={addPropertyType}
						onRemove={removePropertyType}
						onToggleReadOnly={toggleReadOnly}
						onUpdateDimensions={updatePropertyDimensions}
					/>
				</>
			)}
		</Disclosure>
	);
};

export default Properties;
