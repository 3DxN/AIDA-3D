import { useState } from 'react';
import { XIcon } from '@heroicons/react/solid';
import Input from '../../interaction/Input';
import Switch from '../../interaction/Switch';

interface PropertyModalProps {
    isOpen: boolean;
    onClose: () => void;
    propertyTypes: { id: number; name: string; count: number, readOnly: boolean; dimensions?: number[]; }[];
    onAdd: (name: string, dimensions: string) => void;
    onRemove: (name: string) => void;
    onToggleReadOnly: (name: string) => void;
    onUpdateDimensions: (name: string, dimensions: number[]) => void;
}

const PropertyModal = ({ isOpen, onClose, propertyTypes, onAdd, onRemove, onToggleReadOnly, onUpdateDimensions }: PropertyModalProps) => {
    if (!isOpen) return null;
    const [toRemove, setToRemove] = useState<Set<string>>(new Set());
    const [newPropertyName, setNewPropertyName] = useState('');
    const [newPropertyDims, setNewPropertyDims] = useState('');


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

    const handleAddClick = () => {
        if (newPropertyName.trim()) {
            onAdd(newPropertyName, newPropertyDims);
            setNewPropertyName('');
            setNewPropertyDims('');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-1/2 max-w-2xl h-[32rem] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold">Manage Property Types</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>
                <div className="mb-4">
                    <div className="flex items-end space-x-4">
                        <div className="flex-grow">
                            <Input
                                value={newPropertyName}
                                onChange={setNewPropertyName}
                                commitInput={handleAddClick}
                                label="Add new property type"
                                placeholder="New property name"
                            />
                        </div>
                        <div className="flex-shrink-0">
                            <Input
                                label="Dimensions (e.g., 3, 3x3)"
                                value={newPropertyDims}
                                onChange={setNewPropertyDims}
                                commitInput={handleAddClick}
                                placeholder="Leave blank for single value"
                            />
                        </div>
                        <button
                            onClick={handleAddClick}
                            className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 text-sm"
                        >
                            Add Property
                        </button>
                    </div>
                </div>

                <div className="border-t border-gray-200 my-4"></div>

                <div className="flex-grow overflow-hidden flex flex-col">
                    <div className="grid grid-cols-3 gap-4 px-4 pb-2 border-b">
                        <h3 className="text-md font-semibold col-span-1">Property</h3>
                        <h3 className="text-md font-semibold col-span-1">Read-only</h3>
                        <div className="col-span-1">
                            {toRemove.size > 0 ? (
                                <button
                                    onClick={handleRemoveClick}
                                    className="w-full bg-red-500 text-white py-1 px-2 rounded hover:bg-red-600 text-sm"
                                >
                                    Remove ({toRemove.size})
                                </button>
                            ) : (
                                <h3 className="text-md font-semibold">Remove</h3>
                            )}
                        </div>
                    </div>
                    <ul className="space-y-2 overflow-y-auto">
                        {propertyTypes.map((attr, index) => (
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

export default PropertyModal;