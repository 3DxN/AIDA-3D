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
	globalLabels: React.MutableRefObject<
		{ nucleus_index: number;[key: string]: number }[]
	>;
	globalLabelTypes: React.MutableRefObject<
		{ id: number; name: string; count: number }[]
	>;
	setFeatureData: (updater: (prevData: any) => any) => void;
}) => {
	const {
		renderer,
		content,
		globalLabels,
		globalLabelTypes,
		setFeatureData,
	} = props;
	const fileInputRef = useRef<HTMLInputElement>(null);

	const exportData = useCallback(() => {
		const output = JSON.stringify(globalLabels.current, null, 2);

		const element = document.createElement('a');
		element.setAttribute(
			'href',
			'data:text/plain;charset=utf-8,' + encodeURIComponent(output)
		);
		element.setAttribute('download', 'labels.json');

		element.style.display = 'none';
		document.body.appendChild(element);
		element.click();
		document.body.removeChild(element);
	}, [globalLabels]);

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
					throw new Error('Invalid labels.json format: must be an array.');
				}

				if (importedData.length === 0) {
					console.warn('Imported labels.json is empty.');
					globalLabels.current = [];
					globalLabelTypes.current = [];
					setFeatureData((prevData: any) => ({ ...prevData, labels: [] }));
					return;
				}

				// Infer label types and find max index from imported data
				const importedLabelNames = new Set<string>();
				const maxIndex = importedData.reduce((max, nucleus) => {
					Object.keys(nucleus).forEach((key) => {
						if (key !== 'nucleus_index') {
							importedLabelNames.add(key);
						}
					});
					return Math.max(max, nucleus.nucleus_index);
				}, 0);

				// Create a map for quick lookup of imported data
				const importedMap = new Map(
					importedData.map((item) => [item.nucleus_index, item])
				);

				// Create a new "dense" array
				const denseLabels = [];
				for (let i = 0; i <= maxIndex; i++) {
					const existingData = importedMap.get(i);
					if (existingData) {
						const completeData: { [key: string]: any } = { ...existingData };
						importedLabelNames.forEach((name) => {
							if (!(name in completeData)) {
								completeData[name] = 0;
							}
						});
						denseLabels.push(completeData);
					} else {
						// Create a default entry for missing indices
						const defaultEntry: { [key: string]: number | string } = {
							nucleus_index: i,
						};
						importedLabelNames.forEach((name) => {
							defaultEntry[name] = 0;
						});
						denseLabels.push(defaultEntry);
					}
				}

				// Update global state
				globalLabelTypes.current = Array.from(importedLabelNames).map(
					(name, id) => ({ id, name, count: 0 })
				);
				globalLabels.current = denseLabels;

				setFeatureData((prevData: any) => ({
					...prevData,
					labels: denseLabels,
				}));
			} catch (error) {
				console.error('Error parsing labels.json:', error);
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
						Import/Export Labels
					</Disclosure.Button>
					<Disclosure.Panel className="relative px-4 py-2 w-48">
						<div className="flex flex-col space-y-2">
							<button
								onClick={handleImportClick}
								type="button"
								className="inline-flex items-center justify-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
							>
								Import labels.json
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
								Export labels.json
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