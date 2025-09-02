// src/components/interaction/NumberField.tsx
import { useRef, useEffect } from 'react';

const NumberField = (props: {
	value: number;
	onChange: (value: number) => void;
	label?: string;
	disabled?: boolean;
}) => {
	const { value, onChange, label, disabled } = props;
	const inputRef = useRef<HTMLInputElement>(null);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		if (val === '') {
			onChange(NaN);
		} else {
			onChange(parseFloat(val));
		}
	};

	return (
		<div>
			{label && (
				<label
					className={`block text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'
						}`}
				>
					{label}
				</label>
			)}
			<div className="relative rounded-md shadow-sm">
				<input
					ref={inputRef}
					type="number"
					value={isNaN(value) ? '' : value}
					onChange={handleChange}
					disabled={disabled}
					className="pl-2 pr-1 text-xs focus:outline-none focus:ring-teal-500 w-full focus:border-teal-500 min-w-0 border border-gray-300 rounded-md disabled:bg-gray-100"
				/>
			</div>
		</div>
	);
};

export default NumberField;