// src/components/viewer3D/settings/Labels.tsx

import { useState, useEffect, useCallback } from 'react';
import { Disclosure } from '@headlessui/react';
import { XIcon } from '@heroicons/react/solid';
import Input from '../../interaction/Input';
import NumberField from '../../interaction/NumberField';
import { Mesh } from 'three';

const MAX_LABELS = 256;

function classNames(...classes: any[]) {
	return classes.filter(Boolean).join(' ');
}

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

	const [labelError, setLabelError] = useState<string | null>(null);
	const [selectedNucleusData, setSelectedNucleusData] = useState<{ [key: string]: number } | null>(null);

	useEffect(() => {
		if (selected.length === 1 && featureData?.labels) {
			const selectedIndex = Number(selected[0].name.split('_')[1]);
			const data = featureData.labels.find(
				(l: any) => l.nucleus_index === selectedIndex
			);
			setSelectedNucleusData(data);
		} else {
			setSelectedNucleusData(null);
		}
	}, [selected, featureData]);

	const commitInput = useCallback(
		(labelStr: string) => {
			setLabelError(null);
			const labelName = labelStr.trim();
			if (!labelName) return;

			let labelType = globalLabelTypes.current.find(
				(lt) => lt.name === labelName
			);

			if (!labelType) {
				if (globalLabelTypes.current.length >= MAX_LABELS) {
					setLabelError(`Cannot add more than ${MAX_LABELS} label types.`);
					return;
				}
				const newId = globalLabelTypes.current.length;
				globalLabelTypes.current.push({ id: newId, name: labelName, count: 0 });

				globalLabels.current.forEach((nucleus) => {
					nucleus[labelName] = 0;
				});
			}

			setFeatureData((prevData: any) => ({
				...prevData,
				labels: [...globalLabels.current],
			}));
		},
		[setFeatureData, globalLabels, globalLabelTypes]
	);

	const updateLabelValue = useCallback(
		(labelName: string, value: number) => {
			const selectedIndices = new Set(
				selected.map((mesh: THREE.Mesh) => Number(mesh.name.split('_')[1]))
			);

			globalLabels.current.forEach((nucleus) => {
				if (selectedIndices.has(nucleus.nucleus_index)) {
					nucleus[labelName] = value;
				}
			});

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
								label={'Add label type'}
								placeholder="New label name"
							/>
						</div>
						{labelError && (
							<div className="mt-2 text-sm text-red-600">{labelError}</div>
						)}
						<div className="mt-4">
							{selected.length === 1 && selectedNucleusData ? (
								<>
									<div className="text-sm font-medium text-gray-700 mb-2">
										Nucleus {selectedNucleusData.nucleus_index} Labels:
									</div>
									<div className="max-h-40 overflow-y-auto space-y-2">
										{globalLabelTypes.current.map((labelType) => (
											<div key={labelType.id} className="flex items-center justify-between">
												<span className="text-sm truncate mr-2">{labelType.name}</span>
												<div className="w-20">
													<NumberField
														value={selectedNucleusData[labelType.name] || 0}
														onChange={(value) => updateLabelValue(labelType.name, value)}
													/>
												</div>
											</div>
										))}
									</div>
								</>
							) : selected.length > 1 ? (
								<div className="text-sm text-gray-500">
									Multiple nuclei selected. Add or update labels for all selected nuclei.
									<div className="max-h-40 overflow-y-auto space-y-2 mt-2">
										{globalLabelTypes.current.map((labelType) => (
											<div key={labelType.id} className="flex items-center justify-between">
												<span className="text-sm truncate mr-2">{labelType.name}</span>
												<div className="w-20">
													<NumberField
														onChange={(value) => updateLabelValue(labelType.name, value)}
													/>
												</div>
											</div>
										))}
									</div>
								</div>
							) : (
								<div className="text-sm text-gray-500">
									Select a nucleus to view and edit its labels.
								</div>
							)}
						</div>
					</Disclosure.Panel>
				</>
			)}
		</Disclosure>
	);
};

export default Labels;