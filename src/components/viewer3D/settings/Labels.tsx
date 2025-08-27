// src/components/viewer3D/settings/Labels.tsx

import { useState, useEffect, useCallback } from 'react';
import { Disclosure } from '@headlessui/react';
import { XIcon } from '@heroicons/react/solid';
import Input from '../../interaction/Input';

function classNames(...classes: any[]) {
	return classes.filter(Boolean).join(' ');
}

const findCommon = (sets: Set<number>[]) => {
	if (!sets || sets.length === 0) return new Set<number>();
	const result = new Set(sets[0]);
	for (let i = 1; i < sets.length; i++) {
		const currentSet = sets[i];
		result.forEach((value) => {
			if (!currentSet || !currentSet.has(value)) {
				result.delete(value);
			}
		});
	}
	return result;
};

const Labels = (props: any) => {
	const {
		featureData,
		selected,
		setFeatureData,
		globalLabels,
		globalLabelTypes,
	} = props;

	const [commonLabelIds, setCommonLabelIds] = useState(new Set<number>());

	useEffect(() => {
		if (selected.length === 0) {
			setCommonLabelIds(new Set());
			return;
		}

		if (featureData?.labels) {
			const selectedLabels = selected.map((mesh: THREE.Mesh) => {
				const index = Number(mesh.name.split('_')[1]);
				return featureData.labels[index];
			});
			setCommonLabelIds(findCommon(selectedLabels));
		}
	}, [selected, featureData]);

	const commitInput = useCallback(
		(labelStr: string) => {
			if (!globalLabels?.current || !globalLabelTypes?.current) return;

			let labelId = globalLabelTypes.current.indexOf(labelStr);
			if (labelId === -1) {
				labelId = globalLabelTypes.current.length;
				globalLabelTypes.current.push(labelStr);
			}

			setFeatureData((prevData: any) => {
				const newLabels = [...(prevData.labels || [])];
				for (const mesh of selected) {
					const index = Number(mesh.name.split('_')[1]);
					const updatedLabels = new Set<number>(newLabels[index] || []);
					updatedLabels.add(labelId);
					newLabels[index] = updatedLabels;
					globalLabels.current.set(index, updatedLabels);
				}
				return { ...prevData, labels: newLabels };
			});
		},
		[selected, setFeatureData, globalLabels, globalLabelTypes]
	);

	const removeLabel = useCallback(
		(labelId: number) => {
			if (!globalLabels?.current) return;

			setFeatureData((prevData: any) => {
				const newLabels = [...(prevData.labels || [])];
				for (const mesh of selected) {
					const index = Number(mesh.name.split('_')[1]);
					if (newLabels[index]) {
						const updatedLabels = new Set(newLabels[index]);
						updatedLabels.delete(labelId);
						newLabels[index] = updatedLabels;

						if (updatedLabels.size === 0) {
							globalLabels.current.delete(index);
						} else {
							globalLabels.current.set(index, updatedLabels);
						}
					}
				}
				return { ...prevData, labels: newLabels };
			});
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

						{selected.length > 0 && (
							<>
								{' '}
								<div className="ml-2 mt-4 mb-1 text-sm">
									Selected item labels:
								</div>
								{Array.from(commonLabelIds).map((labelId: number) => {
									const labelStr = globalLabelTypes.current[labelId];
									return (
										<div
											key={labelId}
											className="flex items-center justify-between mx-2 max-w-48"
										>
											<div className="truncate">{labelStr}</div>
											<button
												type="button"
												className="flex-none inline-flex items-center rounded-full text-gray-500 hover:text-gray-800 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500"
												onClick={() => removeLabel(labelId)}
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