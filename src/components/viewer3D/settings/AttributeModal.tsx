// src/components/viewer3D/settings/AttributeModal.tsx

import { useState } from 'react';
import { XIcon } from '@heroicons/react/solid';
import Input from '../../interaction/Input';
import Switch from '../../interaction/Switch';

interface AttributeModalProps {
    isOpen: boolean;
    onClose: () => void;
    attributeTypes: { id: number; name: string; count: number, readOnly: boolean }[];
    onAdd: (name: string) => void;
    onRemove: (name: string) => void;
    onToggleReadOnly: (name: string) => void;
}

const AttributeModal = ({ isOpen, onClose, attributeTypes, onAdd, onRemove, onToggleReadOnly }: AttributeModalProps) => {
    if (!isOpen) return null;
    const [toRemove, setToRemove] = useState<Set<string>>(new Set());

    const handleCheckboxChange = (name: string) => {
        const newToRemove = new Set(toRemove);
        if (newToRemove.has(name)) {
            newToRemove.delete(name);
        } else {
            newToRemove.add(name);
        }
        setToRemove(newToRemove);
    };

    const handleRemoveClick = () => {
        toRemove.forEach(name => onRemove(name));
        setToRemove(new Set());
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-1/2 max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold">Manage Attribute Types</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>
                <div className="mb-4">
                    <Input
                        commitInput={onAdd}
                        label="Add new attribute type"
                        placeholder="New attribute name"
                    />
                </div>
                <div>
                    <div className="grid grid-cols-3 gap-4 px-4 pb-2 border-b">
                        <h3 className="text-md font-semibold col-span-1">Attribute</h3>
                        <h3 className="text-md font-semibold col-span-1">Read-only</h3>
                        <div className="col-span-1">
                            {toRemove.size > 0 ? (
                                <button
                                    onClick={handleRemoveClick}
                                    className="w-full bg-red-500 text-white py-1 px-2 rounded hover:bg-red-600 text-sm"
                                >
                                    Remove for all nuclei
                                </button>
                            ) : (
                                <h3 className="text-md font-semibold">Remove attribute type</h3>
                            )}
                        </div>
                    </div>
                    <ul className="space-y-2 max-h-60 overflow-y-auto">
                        {attributeTypes.map((attr, index) => (
                            <li key={attr.id} className={`grid grid-cols-3 gap-4 items-center px-4 py-2 ${index % 2 === 0 ? 'bg-gray-50' : ''}`}>
                                <span className="col-span-1">{attr.name}</span>
                                <div className="col-span-1">
                                    <Switch
                                        enabled={attr.readOnly}
                                        onChange={() => onToggleReadOnly(attr.name)}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <input
                                        type="checkbox"
                                        checked={toRemove.has(attr.name)}
                                        onChange={() => handleCheckboxChange(attr.name)}
                                        className="h-5 w-5 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default AttributeModal;