/* eslint-disable max-len */
import { useState, useEffect, useCallback } from 'react'
import { Disclosure } from '@headlessui/react'
import { XIcon } from '@heroicons/react/solid'

import { InputAutoComplete, Item } from '../../interaction/InputAutoComplete'
import InputCombobox from '../../interaction/InputComboBox'
import Input from '../../interaction/Input'

function classNames(...classes) {
	return classes.filter(Boolean).join(' ')
}

// Function finds common elements in array of sets
const findCommon = (sets) => {
	const result = new Set()
	const set = sets[0]
	if (set) {
		if (sets.length === 1) return set

		set.forEach((value) => {
			let match = true

			for (let j = 1; j < sets.length; j++) {
				if (!sets[j] || !sets[j].has(value)) {
					match = false
					break
				}
			}

			if (match) result.add(value)
		})
	}
	return result
}

const Labels = (props) => {
	const { featureData, selected, setFeatureData, globalLabels } = props;

	const [commonLabels, setCommonLabels] = useState(new Set())
	const [existingLabels, setExistingLabels] = useState(new Set<string>())

	// Set the range of existing labels
	useEffect(() => {
		if (featureData && featureData.labels) {
			setExistingLabels(new Set(featureData.labels))
		}
	}, [featureData])

	// Find common labels
	useEffect(() => {
		if (selected.length === 0) {
			setCommonLabels([])
			return
		}

		if (featureData) {
			const data = {}
			for (const [key, value] of Object.entries(featureData)) {
				data[key] = selected.map((mesh) => {
					// TODO: Use a index, or uuid for each mesh, extracting from name seems
					//       liable to go wrong.
					const index = Number(mesh.name.split('_')[1])
					return value[index]
				})
			}

			if (!data.labels) return
			const common = findCommon(data.labels)
			setCommonLabels(common)
		}
	}, [selected, featureData])

	 const commitInput = useCallback(
        (label) => {
            const newLabels = [...(featureData.labels || [])];
            for (const mesh of selected) {
                const index = Number(mesh.name.split('_')[1]);
                if (!newLabels[index]) newLabels[index] = new Set();
                const updatedLabels = new Set(newLabels[index]);
                updatedLabels.add(label);
                newLabels[index] = updatedLabels;
                globalLabels.current.set(index, updatedLabels); // Add this line
            }
            const newFeatureData = { ...featureData, labels: newLabels };
            setFeatureData(newFeatureData)
			setCommonLabels(
			(commonLabels) => new Set([...commonLabels.values(), label])
			)
setExistingLabels(
	(existingLabels) => new Set([...existingLabels.values(), label])
)
		},
		 [selected, featureData, setFeatureData, globalLabels]
	)

	const removeLabel = useCallback(
		(label) => {
			const newLabels = [...(featureData.labels || [])];
			for (const mesh of selected) {
				const index = Number(mesh.name.split('_')[1]);
				const updatedLabels = new Set(newLabels[index]);
				updatedLabels.delete(label);
				newLabels[index] = updatedLabels;

				// If no labels remain, remove from global store
				if (updatedLabels.size === 0) {
					globalLabels.current.delete(index);
				} else {
					globalLabels.current.set(index, updatedLabels);
				}
			}
			const newFeatureData = { ...featureData, labels: newLabels };
			setFeatureData(newFeatureData);	
			setCommonLabels((commonLabels) => {
				const newCommonLabels = new Set(commonLabels);
				newCommonLabels.delete(label);
				return newCommonLabels
			});
		},
		[selected, featureData, setFeatureData, globalLabels]
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
								{/* Show common class labels for the selected items */}
								{Array.from(commonLabels).map((label, index) => {
									return (
										<div
											key={index}
											className="flex items-center justify-between mx-2 max-w-48"
										>
											<div className="truncate">{label}</div>
											<button
												type="button"
												className="flex-none inline-flex items-center rounded-full text-gray-500 hover:text-gray-800 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500"
												onClick={() => removeLabel(label)}
											>
												<XIcon className="h-3 w-3" aria-hidden="true" />
											</button>
										</div>
									)
								})}
							</>
						)}
					</Disclosure.Panel>
				</>
			)}
		</Disclosure>
	)
}

export default Labels
