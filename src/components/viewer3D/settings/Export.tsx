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
		{ id: number; name: string; count: number; readOnly: boolean, dimensions?: number[] }[]
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
		const output = JSON.stringify({
			attributeTypes: globalAttributeTypes.current,
			attributes: globalAttributes.current,
		}, null, 2);

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
	}, [globalAttributes, globalAttributeTypes]);

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

				const imported = JSON.parse(text);
				const importedData = imported.attributes;
				const importedAttributeTypes = imported.attributeTypes;


				if (!Array.isArray(importedData)) {
					throw new Error('Invalid attributes.json format: must be an array.');
				}

				if (importedData.length === 0) {
					console.warn('Imported attributes.json is empty.');
					return;
				}

				globalAttributeTypes.current = importedAttributeTypes;

				// Create a map for quick lookup of imported data
				const importedMap = new Map(
					importedData.map((item) => [item.nucleus_index, item])
				);

				// Find the maximum index from both existing and imported data
				const maxExistingIndex =
					globalAttributes.current.length > 0
						? globalAttributes.current[globalAttributes.current.length - 1].nucleus_index
						: -1;
				const maxImportedIndex = importedData.reduce(
					(max, nucleus) => Math.max(max, nucleus.nucleus_index),
					-1
				);
				const newSize = Math.max(maxExistingIndex, maxImportedIndex);

				// Merge imported data into globalAttributes
				const newglobalAttributes = [...globalAttributes.current];
				for (let i = 0; i <= newSize; i++) {
					const importedNucleusAttributes = importedMap.get(i);
					let existingNucleusAttributes = newglobalAttributes.find(
						(l) => l.nucleus_index === i
					);

					if (existingNucleusAttributes) {
						if (importedNucleusAttributes) {
							// Merge properties from imported data into existing data
							Object.assign(existingNucleusAttributes, importedNucleusAttributes);
						}
					} else if (importedNucleusAttributes) {
						// Add new nucleus data if it doesn't exist
						newglobalAttributes.push(importedNucleusAttributes);
					} else {
						// Add a placeholder for missing indices
						const placeholder: { nucleus_index: number, [key: string]: any } = { nucleus_index: i };
						globalAttributeTypes.current.forEach(lt => {
							if (lt.dimensions) {
								placeholder[lt.name] = Array(lt.dimensions[0]).fill(0).map(() => Array(lt.dimensions[1] || 1).fill(0));
							} else {
								placeholder[lt.name] = 0;
							}
						});
						newglobalAttributes.push(placeholder);
					}
				}

				// Ensure all nuclei have all label types
				newglobalAttributes.forEach(nucleus => {
					globalAttributeTypes.current.forEach(attributeType => {
						if (!(attributeType.name in nucleus)) {
							if (attributeType.dimensions) {
								nucleus[attributeType.name] = Array(attributeType.dimensions[0]).fill(0).map(() => Array(attributeType.dimensions[1] || 1).fill(0));
							} else {
								nucleus[attributeType.name] = 0;
							}
						}
					});
				});


				// Sort by nucleus_index to maintain order
				newglobalAttributes.sort((a, b) => a.nucleus_index - b.nucleus_index);


				globalAttributes.current = newglobalAttributes;

				setFeatureData((prevData: any) => ({
					...prevData,
					labels: [...newglobalAttributes],
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