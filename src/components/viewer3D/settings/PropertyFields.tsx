import { useCallback, Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import NumberField from '../../interaction/NumberField';
import { Mesh } from 'three';
import { ChevronDownIcon } from '@heroicons/react/solid';

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

const PropertyFields = (props: {
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
							return 0;
						}
					}
					return typeof value === 'number' ? value : 0;
				}
				return typeof data[propertyName] === 'number' ? data[propertyName] : 0;
			}
		}
		return 0;
	};

	const getSelectedNucleusIndex = () => {
		if (selected.length === 1) {
			return Number(selected[0].name.split('_')[1]);
		}
		return null;
	};

	const selectedNucleusIndex = getSelectedNucleusIndex();

	return (
		<div className="max-w-md">
			{selected.length === 0 ? (
				<div className="text-sm text-gray-500 mb-2">
					Select a nucleus to edit.
				</div>
			) : selected.length > 1 ? (
				<div className="text-sm text-gray-500 mb-2">
					Select exactly one nucleus to edit properties. ({selected.length} selected)
				</div>
			) : (
				<div className="text-sm font-medium text-gray-700 mb-2">
					Nucleus {selectedNucleusIndex}:
				</div>
			)}
			<div className="space-y-2">
				{globalPropertyTypes.current.map((propertyType) => (
					<div key={propertyType.id}>
						{propertyType.dimensions ? (
							<Menu as="div" className="relative text-left">
								{({ open }) => (
									<>
										<div className="flex items-center gap-2">
											<span className="text-sm whitespace-nowrap">
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
							<div className="flex items-center gap-2">
								<span className="text-sm whitespace-nowrap">
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
	);
};

export default PropertyFields;
