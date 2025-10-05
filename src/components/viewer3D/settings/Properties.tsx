import { useState, useCallback, Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import NumberField from '../../interaction/NumberField';
import PropertyModal from './PropertyModal';
import { Mesh } from 'three';
import { ChevronDownIcon } from '@heroicons/react/solid';


const MAX_LABELS = 256;

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

	const getSelectedNucleusIndex = () => {
		if (selected.length === 1) {
			return Number(selected[0].name.split('_')[1]);
		}
		return null;
	};

	const selectedNucleusIndex = getSelectedNucleusIndex();

	return (
		<>
			<button
				onClick={() => setIsModalOpen(true)}
				className="w-full bg-pink-500 text-white py-1 px-2 rounded hover:bg-pink-600 text-sm"
			>
				Manage Property Types
			</button>
			{propertyError && (
				<div className="mt-2 text-sm text-red-600">{propertyError}</div>
			)}
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
	);
};

export default Properties;
