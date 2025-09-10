import { useCallback, useRef } from 'react';
import { Disclosure } from '@headlessui/react';
import { SaveIcon, UploadIcon } from '@heroicons/react/solid';
import { WebGLRenderer, Group } from 'three';

function classNames(...classes: any[]) {
	return classes.filter(Boolean).join(' ');
}

const getDimensions = (arr: any): number[] => {
	if (!Array.isArray(arr)) {
		return [];
	}
	const dims: number[] = [];
	let current = arr;
	while (Array.isArray(current)) {
		dims.push(current.length);
		current = current[0];
	}
	return dims;
};


const Export = (props: {
	renderer: WebGLRenderer;
	content: Group;
	globalProperties: React.MutableRefObject<
		{ nucleus_index: number;[key: string]: any }[]
	>;
	globalPropertyTypes: React.MutableRefObject<
		{ id: number; name: string; count: number; readOnly: boolean, dimensions?: number[] }[]
	>;
	setFeatureData: (updater: (prevData: any) => any) => void;
}) => {
	const {
		renderer,
		content,
		globalProperties,
		globalPropertyTypes,
		setFeatureData,
	} = props;
	const fileInputRef = useRef<HTMLInputElement>(null);

	const exportData = useCallback(() => {
		// Transform nucleus_index to label-value for export
		const exportData = globalProperties.current.map(item => {
			const { nucleus_index, ...rest } = item;
			return { 'label-value': nucleus_index, ...rest };
		});
		
		const output = JSON.stringify(exportData, null, 2);

		const element = document.createElement('a');
		element.setAttribute(
			'href',
			'data:text/plain;charset=utf-8,' + encodeURIComponent(output)
		);
		element.setAttribute('download', 'properties.json');

		element.style.display = 'none';
		document.body.appendChild(element);
		element.click();
		document.body.removeChild(element);
	}, [globalProperties]);

	const handleImportClick = () => {
		fileInputRef.current?.click();
	};

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const text = e.target?.result;
				if (typeof text !== 'string') return;

				const rawImportedData = JSON.parse(text);

				if (!Array.isArray(rawImportedData)) {
					throw new Error('Invalid properties.json format. Expected an array of objects.');
				}

				if (rawImportedData.length === 0) {
					console.warn('Imported properties.json is empty.');
					return;
				}

				// Transform label-value to nucleus_index for internal use
				const importedData = rawImportedData.map(item => {
					const { 'label-value': labelValue, ...rest } = item;
					// Use label-value if present, otherwise fall back to nucleus_index for backward compatibility
					const nucleus_index = labelValue !== undefined ? labelValue : item.nucleus_index;
					return { nucleus_index, ...rest };
				});

				// Merge property types
				const newPropertyTypesMap = new Map(
					globalPropertyTypes.current.map((attr) => [attr.name, attr])
				);

				if (importedData.length > 0) {
					const sample = importedData[0];
					Object.keys(sample).forEach(key => {
						if (key !== 'nucleus_index' && !newPropertyTypesMap.has(key)) {
							const value = sample[key];
							const isArray = Array.isArray(value);
							const dimensions = isArray ? getDimensions(value) : undefined;
							const isMultiDimensional = isArray && (dimensions.length > 1 || (dimensions.length === 1 && dimensions[0] > 1));

							newPropertyTypesMap.set(key, {
								id: newPropertyTypesMap.size,
								name: key,
								count: 0,
								readOnly: false,
								dimensions: isMultiDimensional ? dimensions : undefined
							});
						}
					});
				}

				globalPropertyTypes.current = Array.from(newPropertyTypesMap.values());


				// Create a map for quick lookup of imported properties
				const importedPropertiesMap = new Map(
					importedData.map((item) => [item.nucleus_index, item])
				);

				// Create a map for quick lookup of existing properties
				const existingPropertiesMap = new Map(
					globalProperties.current.map((item) => [item.nucleus_index, item])
				);

				// Directly use the imported properties, ensuring all nuclei are represented
				const maxNucleusIndex = Math.max(
					globalProperties.current.length > 0 ? globalProperties.current[globalProperties.current.length - 1].nucleus_index : -1,
					importedData.reduce((max, nucleus) => Math.max(max, nucleus.nucleus_index), -1)
				);

				const newGlobalProperties = Array.from({ length: maxNucleusIndex + 1 }, (_, i) => {
					const existingNucleus = existingPropertiesMap.get(i) || { nucleus_index: i };
					const importedNucleus = importedPropertiesMap.get(i) || { nucleus_index: i };

					const mergedNucleus = { ...existingNucleus, ...importedNucleus };

					for (const attrType of globalPropertyTypes.current) {
						if (!(attrType.name in mergedNucleus)) {
							if (attrType.dimensions) {
								const createNestedArray = (dims: number[]): any => {
									if (dims.length === 1) {
										return Array(dims[0]).fill(0);
									}
									const dim = dims[0];
									const rest = dims.slice(1);
									return Array(dim).fill(0).map(() => createNestedArray(rest));
								};
								mergedNucleus[attrType.name] = createNestedArray(attrType.dimensions);
							} else {
								mergedNucleus[attrType.name] = 0;
							}
						}
					}
					return mergedNucleus;
				});

				globalProperties.current = newGlobalProperties;

				setFeatureData((prevData: any) => ({
					...prevData,
					labels: [...newGlobalProperties],
				}));

			} catch (error) {
				console.error('Error parsing or merging properties.json:', error);
			}
		};
		reader.readAsText(file);
	};

	return (
		<Disclosure className="shadow-sm" as="div">
			{({ open }) => (
				<>
					<Disclosure.Button
						className={classNames(
							'text-gray-700 hover:bg-gray-50 border-b border-gray-200 hover:text-gray-900 bg-white group w-full flex items-center pr-2 py-2 text-left text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 relative z-10 ring-inset'
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
						Import/Export Properties
					</Disclosure.Button>
					<Disclosure.Panel className="relative px-4 py-2 w-48">
						<div className="flex flex-col space-y-2">
							<button
								onClick={handleImportClick}
								type="button"
								className="inline-flex items-center justify-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
							>
								Import properties.json
								<UploadIcon
									className="ml-2 -mr-0.5 h-4 w-4"
									aria-hidden="true"
								/>
							</button>
							<input
								type="file"
								ref={fileInputRef}
								onChange={handleFileChange}
								className="hidden"
								accept=".json"
							/>
							<button
								onClick={exportData}
								type="button"
								className="inline-flex items-center justify-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
							>
								Export properties.json
								<SaveIcon
									className="ml-2 -mr-0.5 h-4 w-4"
									aria-hidden="true"
								/>
							</button>
						</div>
					</Disclosure.Panel>
				</>
			)}
		</Disclosure>
	);
};

export default Export;