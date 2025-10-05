import { useState, useRef, useEffect, ReactNode } from 'react'
import { ChevronDownIcon } from '@heroicons/react/solid'

interface DropdownMenuProps {
  label: string
  children: ReactNode
  className?: string
}

export function DropdownMenu({ label, children, className = '' }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 flex items-center gap-1"
      >
        {label}
        <ChevronDownIcon className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <div className={`absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[200px] max-h-[60vh] overflow-y-auto ${isOpen ? '' : 'hidden'}`}>
        {children}
      </div>
    </div>
  )
}

interface MenuBarProps {
  children: ReactNode
  className?: string
}

export function MenuBar({ children, className = '' }: MenuBarProps) {
  return (
    <div className={`flex items-center gap-1 bg-white border-b border-gray-200 px-2 py-1 ${className}`}>
      {children}
    </div>
  )
}
