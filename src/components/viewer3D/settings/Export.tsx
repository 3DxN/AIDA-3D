// src/components/viewer3D/settings/Export.tsx

import { useCallback, useRef } from 'react';
import { Disclosure } from '@headlessui/react';
import { SaveIcon, UploadIcon } from '@heroicons/react/solid';
import { WebGLRenderer, Group } from 'three';

function classNames(...classes: any[]) {
	return classes.filter(Boolean).join(' ');
}

const Export = (props: {
	renderer: WebGLRenderer;
	content: Group;
	globalAttributes: React.MutableRefObject<
		{ nucleus_index: number;[key: string]: any }[]
	>;
	globalAttributeTypes: React.MutableRefObject<
		{ id: number; name: string; count: number; readOnly: boolean }[]
	>;
	setFeatureData: (updater: (prevData: any) => any) => void;
}) => {
	const {
		renderer,
		content,
		globalAttributes,
		globalAttributeTypes,
		setFeatureData,
	} = props;
	const fileInputRef = useRef<HTMLInputElement>(null);

	const exportData = useCallback(() => {
		const attributesForExport = globalAttributes.current.map(nucleus => {
			const newNucleus: any = { nucleus_index: nucleus.nucleus_index };
			for (const key in nucleus) {
				if (key !== 'nucleus_index') {
					if (typeof nucleus[key] === 'number') {
						newNucleus[key] = nucleus[key];
					}
				}
			}
			return newNucleus;
		});


		const output = JSON.stringify(attributesForExport, null, 2);

		const element = document.createElement('a');
		element.setAttribute(
			'href',
			'data:text/plain;charset=utf-8,' + encodeURIComponent(output)
		);
		element.setAttribute('download', 'attributes.json');

		element.style.display = 'none';
		document.body.appendChild(element);
		element.click();
		document.body.removeChild(element);
	}, [globalAttributes]);

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

				const importedData = JSON.parse(text);

				if (!Array.isArray(importedData)) {
					throw new Error('Invalid attributes.json format. Expected an array of objects.');
				}

				if (importedData.length === 0) {
					console.warn('Imported attributes.json is empty.');
					return;
				}

				const newAttributeTypesMap = new Map<string, { id: number; name: string; count: number; readOnly: boolean }>();
				globalAttributeTypes.current.forEach(attr => newAttributeTypesMap.set(attr.name, attr));

				importedData.forEach(nucleus => {
					Object.keys(nucleus).forEach(key => {
						if (key !== 'nucleus_index' && typeof nucleus[key] === 'number' && !newAttributeTypesMap.has(key)) {
							newAttributeTypesMap.set(key, {
								id: newAttributeTypesMap.size,
								name: key,
								count: 0,
								readOnly: false
							});
						}
					});
				});

				globalAttributeTypes.current = Array.from(newAttributeTypesMap.values());


				// Create a map for quick lookup of imported attributes
				const importedAttributesMap = new Map(
					importedData.map((item) => [item.nucleus_index, item])
				);

				// Create a map for quick lookup of existing attributes
				const existingAttributesMap = new Map(
					globalAttributes.current.map((item) => [item.nucleus_index, item])
				);

				// Directly use the imported attributes, ensuring all nuclei are represented
				const maxNucleusIndex = Math.max(
					globalAttributes.current.length > 0 ? globalAttributes.current[globalAttributes.current.length - 1].nucleus_index : -1,
					importedData.reduce((max, nucleus) => Math.max(max, nucleus.nucleus_index), -1)
				);

				const newGlobalAttributes = Array.from({ length: maxNucleusIndex + 1 }, (_, i) => {
					const existingNucleus = existingAttributesMap.get(i) || { nucleus_index: i };
					const importedNucleus = importedAttributesMap.get(i) || { nucleus_index: i };

					const mergedNucleus = { ...existingNucleus, ...importedNucleus };

					for (const attrType of globalAttributeTypes.current) {
						if (!(attrType.name in mergedNucleus)) {
							mergedNucleus[attrType.name] = 0;
						}
					}
					return mergedNucleus;
				});

				globalAttributes.current = newGlobalAttributes;

				setFeatureData((prevData: any) => ({
					...prevData,
					labels: [...newGlobalAttributes],
				}));

			} catch (error) {
				console.error('Error parsing or merging attributes.json:', error);
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
						Import/Export Attributes
					</Disclosure.Button>
					<Disclosure.Panel className="relative px-4 py-2 w-48">
						<div className="flex flex-col space-y-2">
							<button
								onClick={handleImportClick}
								type="button"
								className="inline-flex items-center justify-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
							>
								Import attributes.json
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
								Export attributes.json
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