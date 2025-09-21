import { useEffect, useRef } from 'react'

export default function Input(props: {
	commitInput: (value: string) => void
	value?: string
	onChange?: (value: string) => void
	label?: string
	disabled?: boolean
	placeholder?: string
}) {
	const { commitInput, value, onChange, label, disabled, placeholder } = props

	const inputRef = useRef<HTMLInputElement>(null)

	// Add key listener to commit on enter
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Enter' && !disabled && (e.currentTarget as HTMLInputElement)?.value.length > 0) {
				e.preventDefault()
				commitInput((e.currentTarget as HTMLInputElement).value);
				// If it's a controlled component, clear the value via the parent state
				if (onChange) {
					onChange('');
				}
			}
		}

		const input = inputRef.current
		input?.addEventListener('keydown', handleKeyDown)
		return () => input?.removeEventListener('keydown', handleKeyDown)
	}, [commitInput, disabled, onChange])

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (onChange) {
			onChange(e.target.value);
		}
	}

	return (
		<div>
			{label && (
				<label
					htmlFor="input-text"
					className={`${disabled ? 'text-gray-400' : 'text-gray-700'
						} block text-sm font-medium `}
				>
					{label}
				</label>
			)}
			<div className="mt-1">
				<input
					ref={inputRef}
					type="text"
					name="input-text"
					id="input-text"
					value={value || ''}
					onChange={handleChange}
					className="shadow-sm focus:ring-teal-500 focus:border-teal-500 block w-full sm:text-sm border-gray-300 rounded-md"
					placeholder={placeholder || ''}
					disabled={disabled}
				/>
			</div>
		</div>
	)
}