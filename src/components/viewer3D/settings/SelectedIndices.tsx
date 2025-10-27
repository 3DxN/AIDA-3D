
import { Disclosure } from '@headlessui/react'
import { Mesh } from 'three'

function classNames(...classes: string[]) {
	return classes.filter(Boolean).join(' ')
}

const SelectedIndices = (props: { selected: Mesh[] }) => {
	const { selected } = props

	const selectedIndices = selected.map((mesh) => {
		return Number(mesh.name.split('_')[1])
	})

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
						Selected Nuclei
					</Disclosure.Button>
					<Disclosure.Panel className="relative px-4 py-2">
						{selectedIndices.length > 0 ? (
							<div className="max-h-40 overflow-y-auto">
								<ul className="list-disc pl-5">
									{selectedIndices.map((index) => (
										<li key={index} className="text-sm">
											label-value: {index}
										</li>
									))}
								</ul>
							</div>
						) : (
							<div className="text-sm text-gray-500">
								No nuclei selected.
							</div>
						)}
					</Disclosure.Panel>
				</>
			)}
		</Disclosure>
	)
}

export default SelectedIndices