// src/components/viewer3D/settings/Labels.tsx

import { useState, useEffect, useCallback } from 'react';
import { Disclosure } from '@headlessui/react';
import { XIcon } from '@heroicons/react/solid';
import Input from '../../interaction/Input';
import { Mesh } from 'three';

const MAX_LABELS = 256;

function classNames(...classes: any[]) {
	return classes.filter(Boolean).join(' ');
}

// This function finds which labels are active (value=1) for ALL selected nuclei
const findCommonActiveLabels = (
	labelsData: { nucleus_index: number;[key: string]: number }[],
	selectedMeshes: THREE.Mesh[],
	allLabelTypes: string[]
) => {
	if (!labelsData || selectedMeshes.length === 0) {
		return [];
	}

	const selectedIndices = new Set(
		selectedMeshes.map((mesh) => Number(mesh.name.split('_')[1]))
	);

	// Start with all possible label types as candidates
	const commonLabels = new Set(allLabelTypes);

	// Iterate through selected nuclei and remove labels that are not active for any of them
	for (const mesh of selectedMeshes) {
		const index = Number(mesh.name.split('_')[1]);
		const nucleusData = labelsData.find((l) => l.nucleus_index === index);

		if (!nucleusData) {
			// If a selected nucleus has no data, no labels can be common
			return [];
		}

		commonLabels.forEach((labelName) => {
			if (nucleusData[labelName] !== 1) {
				commonLabels.delete(labelName);
			}
		});
	}

	return Array.from(commonLabels);
};

const Labels = (props: {
	featureData: any;
	selected: Mesh[];
	setFeatureData: (updater: (prevData: any) => any) => void;
	globalLabels: React.MutableRefObject<
		{ nucleus_index: number;[key: string]: number }[]
	>;
	globalLabelTypes: React.MutableRefObject<
		{ id: number; name: string; count: number }[]
	>;
}) => {
	const {
		featureData,
		selected,
		setFeatureData,
		globalLabels,
		globalLabelTypes,
	} = props;

	const [commonLabelNames, setCommonLabelNames] = useState<string[]>([]);
	const [labelError, setLabelError] = useState<string | null>(null);

	useEffect(() => {
		if (selected.length === 0 || !featureData?.labels) {
			setCommonLabelNames([]);
			return;
		}
		const allTypes = globalLabelTypes.current.map((lt) => lt.name);
		setCommonLabelNames(
			findCommonActiveLabels(featureData.labels, selected, allTypes)
		);
	}, [selected, featureData, globalLabelTypes]);

	const commitInput = useCallback(
		(labelStr: string) => {
			setLabelError(null);

			const labelName = labelStr.trim();
			if (!labelName) return;

			// Check if label type already exists
			let labelType = globalLabelTypes.current.find(
				(lt) => lt.name === labelName
			);

			// If it's a new label type, add it
			if (!labelType) {
				if (globalLabelTypes.current.length >= MAX_LABELS) {
					setLabelError(`Cannot add more than ${MAX_LABELS} label types.`);
					return;
				}
				const newId = globalLabelTypes.current.length;
				globalLabelTypes.current.push({ id: newId, name: labelName, count: 0 });

				// Add the new label key with default value 0 to every nucleus
				globalLabels.current.forEach((nucleus) => {
					nucleus[labelName] = 0;
				});
			}

			// Apply the label (set to 1) to selected nuclei
			const selectedIndices = new Set(
				selected.map((mesh: THREE.Mesh) => Number(mesh.name.split('_')[1]))
			);

			globalLabels.current.forEach((nucleus) => {
				if (selectedIndices.has(nucleus.nucleus_index)) {
					nucleus[labelName] = 1;
				}
			});

			// Update state to trigger re-render
			setFeatureData((prevData: any) => ({
				...prevData,
				labels: [...globalLabels.current],
			}));
		},
		[selected, setFeatureData, globalLabels, globalLabelTypes]
	);

	const removeLabel = useCallback(
		(labelName: string) => {
			// This function now acts as a toggle, setting the label value to 0 for selected items
			const selectedIndices = new Set(
				selected.map((mesh: THREE.Mesh) => Number(mesh.name.split('_')[1]))
			);

			globalLabels.current.forEach((nucleus) => {
				if (selectedIndices.has(nucleus.nucleus_index)) {
					nucleus[labelName] = 0;
				}
			});

			// Update state to trigger re-render
			setFeatureData((prevData: any) => ({
				...prevData,
				labels: [...globalLabels.current],
			}));
		},
		[selected, setFeatureData, globalLabels]
	);

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
						Labels
					</Disclosure.Button>
					<Disclosure.Panel className="relative px-4 py-2 w-48">
						<div>
							<Input
								commitInput={commitInput}
								label={'Add label'}
								disabled={selected.length === 0}
							/>
						</div>
						{labelError && (
							<div className="mt-2 text-sm text-red-600">{labelError}</div>
						)}
						{selected.length > 0 && (
							<>
								{' '}
								<div className="ml-2 mt-4 mb-1 text-sm">
									Selected item labels:
								</div>
								{commonLabelNames.map((labelName: string) => {
									return (
										<div
											key={labelName}
											className="flex items-center justify-between mx-2 max-w-48"
										>
											<div className="truncate">{labelName}</div>
											<button
												type="button"
												className="flex-none inline-flex items-center rounded-full text-gray-500 hover:text-gray-800 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500"
												onClick={() => removeLabel(labelName)}
											>
												<XIcon className="h-3 w-3" aria-hidden="true" />
											</button>
										</div>
									);
								})}
							</>
						)}
					</Disclosure.Panel>
				</>
			)}
		</Disclosure>
	);
};

export default Labels;