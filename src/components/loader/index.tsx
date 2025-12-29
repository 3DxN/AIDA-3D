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
        loadStore, loadZarrArray, loadCellposeData, isLoading, error,
        hasLoadedArray
    } = useZarrStore();

    const [activeTab, setActiveTab] = useState<'zarr' | 'aida'>('zarr');
    const [server, setServer] = useState('http://localhost:5500');

    const handleLoadStore = () => {
        if (!server) return;

        // Navigate to zarr page with just the server param
        // The in-app explorer will handle the rest
        router.push(`/zarr?server=${encodeURIComponent(server)}`);
    };

    const handleLoadExample = () => {
        setServer('http://141.147.64.20:5500');
    };

    const handleBrowseAIDA = () => {
        router.push('/local');
        onClose();
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
                        <div className="space-y-4 mb-5">
                            <div>
                                <label className="block mb-2 font-bold text-base text-gray-700">Server URL:</label>
                                <input
                                    type="text"
                                    value={server}
                                    onChange={(e) => setServer(e.target.value)}
                                    className="w-full p-3 border-2 border-gray-300 rounded-md text-base outline-none focus:border-teal-500"
                                    placeholder="e.g., http://141.147.64.20:5500/"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 mb-5">
                            <button
                                onClick={handleLoadStore}
                                disabled={isLoading || !server}
                                className={`flex-1 px-6 py-3 text-white border-none rounded-md cursor-pointer text-base font-bold shadow-lg flex items-center justify-center ${isLoading || !server ? 'bg-gray-500 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700'}`}
                            >
                                {isLoading ? (<><RefreshIcon className="h-5 w-5 mr-2 animate-spin" /> Loading...</>) : (<><PlayIcon className="h-5 w-5 mr-2" /> Connect to Server</>)}
                            </button>
                        </div>

                        <div className="text-center mb-5">
                            <button
                                onClick={handleLoadExample}
                                disabled={isLoading}
                                className={`inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                            >
                                <BeakerIcon className="h-5 w-5 mr-2" />
                                Fill Example Values
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

                {hasLoadedArray && <div className="mt-4 p-4 bg-green-50 border border-green-200 text-green-800 rounded-md text-base text-center font-bold"><CheckCircleIcon className="h-5 w-5 inline mr-2" />Store loaded successfully!</div>}
                {isLoading && activeTab === 'zarr' && <div className="mt-4 text-center p-4 bg-blue-50 rounded-md text-teal-700 text-sm"><div className="mb-3 flex items-center justify-center"><RefreshIcon className="h-5 w-5 mr-2 animate-spin" />Loading...</div><div className="w-full h-1 bg-blue-200 rounded-full overflow-hidden"><div className="w-1/3 h-full bg-blue-500 rounded-full animate-pulse" /></div></div>}
                {error && activeTab === 'zarr' && <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-md text-base text-center"><div className="flex items-center justify-center"><ExclamationIcon className="h-5 w-5 mr-2" />{error}</div></div>}
            </div>
        </div>
    );
}