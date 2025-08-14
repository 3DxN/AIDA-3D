'use client'

import { SliderProps } from '../../../../types/viewer2D/navProps'


export default function Slider({
  label,
  value,
  min,
  max,
  onChange,
  valueDisplay,
  condition = true
}: SliderProps) {
  
  if (!condition) return null

  const getDisplayValue = () => {
    if (typeof valueDisplay === 'function') {
      return valueDisplay(value, max)
    }
    return valueDisplay || `${value}/${max}`
  }

  return (
    <div>
      <div className="flex gap-1 items-center">
        <label className="block text-xs font-bold">
          {label}:
        </label>
        <div className="text-xs text-gray-600">
          {getDisplayValue()}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full mb-1"
      />
    </div>
  )
}
