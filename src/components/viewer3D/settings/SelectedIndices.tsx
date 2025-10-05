
import { Mesh } from 'three'

const SelectedIndices = (props: { selected: Mesh[] }) => {
	const { selected } = props

	const selectedIndices = selected.map((mesh) => {
		return Number(mesh.name.split('_')[1])
	})

	return (
		<div className="relative px-4 py-2 w-48">
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
		</div>
	)
}

export default SelectedIndices