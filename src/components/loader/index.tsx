// src/components/loader/index.tsx

import React, { useState, useEffect } from 'react'; // Import useEffect
import { useRouter } from 'next/router';
import {
    XIcon, BeakerIcon, FolderIcon, CubeIcon, InformationCircleIcon,
    ExclamationIcon, LightBulbIcon, CheckCircleIcon, RefreshIcon, PlayIcon,
    TableIcon, ExternalLinkIcon
} from '@heroicons/react/solid';

import { useZarrStore } from '../../lib/contexts/ZarrStoreContext';
import { ZarrStoreSuggestionType } from '../../types/store';

export default function StoreLoader({ onClose }: { onClose: () => void }) {
    const router = useRouter();
    const {
        source, root, setSource, loadStore, loadZarrArray, loadCellposeData, isLoading, error,
        infoMessage, suggestedPaths, suggestionType, hasLoadedArray, zarrPath, cellposePath,
        setZarrPath, setCellposePath, store
    } = useZarrStore();

    const [activeTab, setActiveTab] = useState<'zarr' | 'aida'>('zarr');
    const [showZarrSelection, setShowZarrSelection] = useState(false);
    const [showCellposeSelection, setShowCellposeSelection] = useState(false);
    const [tempZarrPath, setTempZarrPath] = useState('');
    const [tempCellposePath, setTempCellposePath] = useState('labels/Cellpose');

    const handleLoadStore = async () => {
        if (!source) return;

        await loadStore(source);
        setShowZarrSelection(true);
    };

    const handleLoadExample = () => {
        const exampleUrl = 'http://141.147.64.20:5500/';
        const exampleZarrPath = '0';
        const exampleCellposePath = 'labels/Cellpose';

        setSource(exampleUrl);
        setTempZarrPath(exampleZarrPath);
        setTempCellposePath(exampleCellposePath);

        // Update URL with all parameters
        router.push(
            `/zarr?src=${encodeURIComponent(exampleUrl)}&zarr=${encodeURIComponent(exampleZarrPath)}&cellpose=${encodeURIComponent(exampleCellposePath)}`,
            undefined,
            { shallow: true }
        );

        // Load store and then load the paths
        loadStore(exampleUrl).then(() => {
            loadZarrArray(exampleZarrPath).then(() => {
                loadCellposeData(exampleCellposePath);
            });
        });
    };

    const handleZarrPathSubmit = async () => {
        if (!tempZarrPath) return;

        // Update URL with zarr path
        const params = new URLSearchParams();
        params.set('src', source);
        params.set('zarr', tempZarrPath);
        router.push(`/zarr?${params.toString()}`, undefined, { shallow: true });

        setShowZarrSelection(false);
        await loadZarrArray(tempZarrPath);
        setShowCellposeSelection(true);
    };

    const handleCellposePathSubmit = async () => {
        if (!tempCellposePath) return;

        // Update URL with cellpose path
        const params = new URLSearchParams();
        params.set('src', source);
        params.set('zarr', zarrPath);
        params.set('cellpose', tempCellposePath);
        router.push(`/zarr?${params.toString()}`, undefined, { shallow: true });

        await loadCellposeData(tempCellposePath);
        setShowCellposeSelection(false);

        // Close the loader after a short delay to show success message
        setTimeout(() => {
            onClose();
        }, 1000);
    };

    const handleBrowseAIDA = () => {
        router.push('/local');
        onClose();
    };

    const renderPathSelector = (
        title: string,
        description: string,
        value: string,
        onChange: (value: string) => void,
        onSubmit: () => void,
        placeholder: string
    ) => {
        return (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center justify-center mb-2 font-semibold text-center text-blue-800">
                    <FolderIcon className="h-5 w-5 mr-2" />
                    <span>{title}</span>
                </div>
                <div className="mb-3 text-sm text-blue-700">{description}</div>

                {suggestedPaths.length > 0 && (
                    <div className="mb-3">
                        <div className="text-xs text-blue-600 mb-2">Available paths:</div>
                        <div className="flex flex-wrap gap-2">
                            {suggestedPaths.map((suggestion, index) => (
                                <button
                                    key={index}
                                    onClick={() => onChange(suggestion.path)}
                                    className={`px-3 py-1 text-white border-none rounded text-xs cursor-pointer transition-opacity hover:opacity-80 ${suggestion.hasOme ? 'bg-green-600' : suggestion.isGroup ? 'bg-blue-500' : 'bg-gray-600'}`}
                                    title={suggestion.hasOme ? 'OME-Zarr group' : suggestion.isGroup ? 'Zarr group' : 'Zarr array'}
                                >
                                    {suggestion.path}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex gap-2 items-end">
                    <div className="flex-1">
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            className="w-full p-2 border-2 border-blue-300 rounded-md text-sm outline-none focus:border-blue-500"
                            placeholder={placeholder}
                        />
                    </div>
                    <button
                        onClick={onSubmit}
                        disabled={!value}
                        className={`px-4 py-2 text-white border-none rounded-md cursor-pointer text-sm font-bold whitespace-nowrap ${!value ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        Load
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 p-4">
            <div className="relative w-full max-w-2xl bg-white shadow-2xl rounded-xl p-8 border-2 border-gray-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 rounded-full text-gray-500 hover:bg-gray-200"
                >
                    <XIcon className="h-5 w-5" />
                </button>

                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-teal-600 mb-2 flex items-center justify-center">
                        <BeakerIcon className="h-6 w-6 mr-2" />
                        AIDA Image Loader
                    </h2>
                    <p className="text-gray-500 text-base">
                        Load an OME-Zarr store or browse AIDA projects
                    </p>
                </div>

                <div className="flex border-b border-gray-300 mb-6">
                    <button
                        onClick={() => setActiveTab('zarr')}
                        className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center ${activeTab === 'zarr' ? 'border-teal-500 text-teal-600 bg-teal-50' : 'border-transparent text-gray-500 hover:border-gray-300'}`}
                    >
                        <CubeIcon className="h-4 w-4 mr-2" />
                        Zarr Store
                    </button>
                    <button
                        onClick={() => setActiveTab('aida')}
                        className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center ${activeTab === 'aida' ? 'border-teal-500 text-teal-600 bg-teal-50' : 'border-transparent text-gray-500 hover:border-gray-300'}`}
                    >
                        <FolderIcon className="h-4 w-4 mr-2" />
                        AIDA Projects
                    </button>
                </div>

                {activeTab === 'zarr' && (
                    <>
                        <div className="flex gap-4 items-end mb-5">
                            <div className="flex-1 min-w-0">
                                <label className="block mb-2 font-bold text-base text-gray-700">Store URL:</label>
                                <input
                                    type="text"
                                    value={source}
                                    onChange={(e) => setSource(e.target.value)}
                                    className="w-full p-3 border-2 border-gray-300 rounded-md text-base outline-none focus:border-teal-500"
                                    placeholder="Enter Zarr store URL"
                                    disabled={!!store}
                                />
                            </div>
                            <button
                                onClick={handleLoadStore}
                                disabled={isLoading || !source || !!store}
                                className={`px-6 py-3 text-white border-none rounded-md cursor-pointer text-base font-bold flex-shrink-0 whitespace-nowrap shadow-lg flex items-center ${isLoading || !source || !!store ? 'bg-gray-500 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700'}`}
                            >
                                {isLoading ? (<><RefreshIcon className="h-5 w-5 mr-2 animate-spin" /> Loading...</>) : (<><PlayIcon className="h-5 w-5 mr-2" /> Load Store</>)}
                            </button>
                        </div>

                        <div className="text-center mb-5">
                            <button
                                onClick={handleLoadExample}
                                disabled={isLoading}
                                className={`inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                            >
                                <BeakerIcon className="h-5 w-5 mr-2" />
                                Load Example Store
                            </button>
                        </div>

                        {showZarrSelection && !hasLoadedArray && renderPathSelector(
                            'Select Zarr Array Directory',
                            'Choose the path to the zarr array within the store (e.g., "0", "1", etc.)',
                            tempZarrPath,
                            setTempZarrPath,
                            handleZarrPathSubmit,
                            'Enter zarr array path'
                        )}

                        {showCellposeSelection && hasLoadedArray && renderPathSelector(
                            'Select Cellpose Segmentation Directory',
                            'Choose the path to the cellpose segmentation data (e.g., "labels/Cellpose")',
                            tempCellposePath,
                            setTempCellposePath,
                            handleCellposePathSubmit,
                            'Enter cellpose path'
                        )}
                    </>
                )}

                {activeTab === 'aida' && (
                    <div className="text-center">
                        <div className="mb-6 p-4 bg-teal-50 rounded-lg border border-teal-200">
                            <p className="text-teal-800 mb-4">Browse local DZI, TIFF, and project files.</p>
                            <button
                                onClick={handleBrowseAIDA}
                                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700"
                            >
                                <ExternalLinkIcon className="h-5 w-5 mr-2" />
                                Browse Local Projects
                            </button>
                        </div>
                    </div>
                )}

                {hasLoadedArray && !showCellposeSelection && <div className="mt-4 p-4 bg-green-50 border border-green-200 text-green-800 rounded-md text-base text-center font-bold"><CheckCircleIcon className="h-5 w-5 inline mr-2" />Zarr array loaded successfully!</div>}
                {isLoading && activeTab === 'zarr' && <div className="mt-4 text-center p-4 bg-blue-50 rounded-md text-teal-700 text-sm"><div className="mb-3 flex items-center justify-center"><RefreshIcon className="h-5 w-5 mr-2 animate-spin" />Loading...</div><div className="w-full h-1 bg-blue-200 rounded-full overflow-hidden"><div className="w-1/3 h-full bg-blue-500 rounded-full animate-pulse" /></div></div>}
                {error && activeTab === 'zarr' && <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-md text-base text-center"><div className="flex items-center justify-center"><ExclamationIcon className="h-5 w-5 mr-2" />{error}</div></div>}
            </div>
        </div>
    );
}