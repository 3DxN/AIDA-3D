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
        source, root, setSource, loadStore, isLoading, error,
        infoMessage, suggestedPaths, suggestionType, navigateToSuggestion, hasLoadedArray
    } = useZarrStore();

    const [activeTab, setActiveTab] = useState<'zarr' | 'aida'>('zarr');

    // --- START OF NEW CODE ---
    // State to track if we are in the process of loading the example
    const [isExampleLoading, setIsExampleLoading] = useState(false);

    // This useEffect hook will run whenever `root` or `isExampleLoading` changes
    useEffect(() => {
        // We only proceed if we've initiated the example loading AND the root of the store is now available
        if (isExampleLoading && root) {
            navigateToSuggestion('0');
            // Reset the flag so this doesn't run again accidentally
            setIsExampleLoading(false);
        }
    }, [root, isExampleLoading, navigateToSuggestion]);

    const handleLoadStore = async () => {
        if (!source) return;
        await loadStore(source);
    };

    const handleLoadExample = () => {
        const exampleUrl = 'http://localhost:5500';
        setSource(exampleUrl);

        // Set our flag to true and start loading the store.
        // The useEffect above will handle the next step.
        setIsExampleLoading(true);
        loadStore(exampleUrl);
    };
    // --- END OF NEW CODE ---

    const handleBrowseAIDA = () => {
        router.push('/local');
        onClose();
    };

    const renderSuggestions = () => {
        // ... (this function remains unchanged)
        let suggestionTitle: string;
        let suggestionDescription: string;
        let SuggestionIcon: React.ComponentType<{ className?: string }>;

        switch (suggestionType) {
            case ZarrStoreSuggestionType.PLATE_WELL:
                suggestionTitle = 'OME-Plate/Well structure detected';
                suggestionDescription = 'This format is not supported for direct viewing.';
                SuggestionIcon = TableIcon;
                break;
            default:
                suggestionTitle = 'Try one of these paths';
                suggestionDescription = 'Click to load a potential OME-Zarr location:';
                SuggestionIcon = LightBulbIcon;
                break;
        }

        return (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
                <div className="flex items-center justify-center mb-2 font-semibold text-center">
                    <SuggestionIcon className="h-5 w-5 mr-2" />
                    <span>{suggestionTitle}</span>
                </div>
                {suggestionDescription && <div className="mb-3 text-sm">{suggestionDescription}</div>}
                <div className="flex flex-col items-center gap-2 w-full">
                    <div className="flex flex-wrap justify-center gap-2 w-full">
                        {root && root.path !== "/" && (
                            <button
                                onClick={() => navigateToSuggestion('..')}
                                className="px-3 py-1 text-white border-none rounded text-xs cursor-pointer bg-gray-400 hover:bg-gray-600"
                                title="Go up one directory"
                            >..</button>
                        )}
                        {suggestedPaths.map((suggestion, index) => (
                            <button
                                key={index}
                                onClick={() => navigateToSuggestion(suggestion.path)}
                                className={`px-3 py-1 text-white border-none rounded text-xs cursor-pointer transition-opacity hover:opacity-80 ${suggestion.hasOme ? 'bg-green-600' : suggestion.isGroup ? 'bg-blue-500' : 'bg-gray-600'}`}
                                title={suggestion.hasOme ? 'OME-Zarr group' : suggestion.isGroup ? 'Zarr group' : 'Zarr array'}
                            >
                                {suggestion.path}
                            </button>
                        ))}
                    </div>
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
                                />
                            </div>
                            <button
                                onClick={handleLoadStore}
                                disabled={isLoading || !source}
                                className={`px-6 py-3 text-white border-none rounded-md cursor-pointer text-base font-bold flex-shrink-0 whitespace-nowrap shadow-lg flex items-center ${isLoading || !source ? 'bg-gray-500 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700'}`}
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

                {hasLoadedArray && <div className="mt-4 p-4 bg-green-50 border border-green-200 text-green-800 rounded-md text-base text-center font-bold"><CheckCircleIcon className="h-5 w-5 inline mr-2" />Store loaded!</div>}
                {isLoading && !hasLoadedArray && activeTab === 'zarr' && <div className="mt-4 text-center p-4 bg-blue-50 rounded-md text-teal-700 text-sm"><div className="mb-3 flex items-center justify-center"><RefreshIcon className="h-5 w-5 mr-2 animate-spin" />Loading Zarr store...</div><div className="w-full h-1 bg-blue-200 rounded-full overflow-hidden"><div className="w-1/3 h-full bg-blue-500 rounded-full animate-pulse" /></div></div>}
                {(infoMessage || error) && !hasLoadedArray && activeTab === 'zarr' && <div className={`mt-4 p-4 rounded-md text-base text-center ${[ZarrStoreSuggestionType.PLATE_WELL, ZarrStoreSuggestionType.NO_MULTISCALE].includes(suggestionType) ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>{suggestionType === ZarrStoreSuggestionType.PLATE_WELL ? <div className="text-center mb-3 flex items-center justify-center"><TableIcon className="h-5 w-5 mr-2" /><strong>OME-Plate/Well Structure Detected</strong></div> : infoMessage ? <div className="flex items-center justify-center"><InformationCircleIcon className="h-5 w-5 mr-2" />{infoMessage}</div> : <div className="flex items-center justify-center"><ExclamationIcon className="h-5 w-5 mr-2" />{error}</div>}{renderSuggestions()}</div>}
            </div>
        </div>
    );
}