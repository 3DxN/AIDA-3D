import React, { useEffect, useState } from 'react'
import { 
    XIcon, 
    BeakerIcon, 
    FolderIcon, 
    CubeIcon, 
    InformationCircleIcon, 
    ExclamationIcon, 
    LightBulbIcon,
    CheckCircleIcon,
    RefreshIcon,
    PlayIcon,
    TableIcon,
    ExternalLinkIcon
} from '@heroicons/react/solid'

import { useZarrStore } from '../../lib/contexts/ZarrStoreContext'
import { ZarrStoreSuggestionType } from '../../types/store'


export default function StoreLoader({ onClose }: { onClose: () => void }) {
    const { 
        source, 
        root,
        setSource, 
        loadStore, 
        isLoading, 
        error, 
        infoMessage,
        suggestedPaths, 
        suggestionType,
        navigateToSuggestion,
        hasLoadedArray: hasLoadedStore
    } = useZarrStore()
    
    const [showSuccess, setShowSuccess] = useState(false)
    const [isVisible, setIsVisible] = useState(true)
    const [isClosing, setIsClosing] = useState(false)
    const [activeTab, setActiveTab] = useState<'zarr' | 'aida'>('zarr')

    // Handle modal auto-close when store loads
    useEffect(() => {
        if (hasLoadedStore && !isClosing) {
            // Show success message first
            setShowSuccess(true)
            
            // Start closing/fading after a brief success display
            setTimeout(() => {
                setIsClosing(true)
            }, 500)
            
            // Remove completely after fade-out animation (1 second)
            setTimeout(() => {
                setIsVisible(false)
                onClose();
            }, 1500) // 500ms success display + 1000ms fade-out
        }
    }, [hasLoadedStore, isClosing])

    const handleLoadStore = async () => {
        if (!source) return
        await loadStore(source)
    }

    const handleBrowseAIDA = () => {
        window.location.href = '/local'
    }

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    // Don't render modal if it's been hidden
    if (!isVisible) {
        return null
    }

    const renderSuggestions = () => {
        let suggestionTitle: string
        let suggestionDescription: string
        let SuggestionIcon: React.ComponentType<{ className?: string }>

        switch (suggestionType) {
        case ZarrStoreSuggestionType.PLATE_WELL:
            suggestionTitle = 'OME-Plate/Well structure detected'
            suggestionDescription = 'OME-Plate/Wells are not supported for direct viewing.'
            SuggestionIcon = TableIcon
            break
        default:
            suggestionTitle = 'Try these paths'
            suggestionDescription = 'Click to load these potential OME-Zarr locations:'
            SuggestionIcon = LightBulbIcon
            break
        }

        return (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
                <div className="flex items-center justify-center mb-2 font-semibold text-center">
                    <SuggestionIcon className="h-5 w-5 mr-2" />
                    <span>{suggestionTitle}</span>
                </div>
                {suggestionDescription && (
                    <div className="mb-3 text-sm">
                        {suggestionDescription}
                    </div>
                )}
                <div className="flex flex-col items-center gap-2 w-full">
                    <div className="flex flex-wrap justify-center gap-2 w-full">
                        {root && root.path !== "/" && (
                            <button
                                onClick={() => navigateToSuggestion('..')}
                                className="px-3 py-1 text-white border-none rounded text-xs cursor-pointer bg-gray-400 hover:bg-gray-600 transition-opacity"
                                title="Go up one directory"
                            >..</button>
                        )}
                        {suggestedPaths.map((suggestion, index) => (
                            <button
                                key={index}
                                onClick={() => navigateToSuggestion(suggestion.path)}
                                className={`px-3 py-1 text-white border-none rounded text-xs cursor-pointer transition-opacity hover:opacity-80 ${
                                    suggestion.hasOme ? 'bg-green-600' : 
                                    suggestion.isGroup ? 'bg-blue-500' : 'bg-gray-600'
                                }`}
                                title={
                                    suggestion.hasOme 
                                    ? 'OME-Zarr group - click to load' 
                                    : suggestion.isGroup 
                                        ? 'Zarr group - click to load' 
                                        : 'Zarr array - click to load'
                                }
                            >
                                {suggestion.path}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="text-xs mt-2 opacity-80">
                    Click a path to load that location
                </div>
            </div>
        )
    }

    return (
        <>
        {/* Modal Overlay */}
        <div 
            className={`fixed inset-0 bg-black bg-opacity-70 z-50 backdrop-blur transition-all duration-1000 ease-out ${
                isClosing ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
            onClick={handleOverlayClick}
        />

        {/* StoreLoader Content */}
        <div className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-11/12 max-w-2xl bg-white shadow-2xl rounded-xl p-8 border-3 border-teal-500 transition-all duration-1000 ease-out ${
            isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}>
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                disabled={isClosing}
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

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-300 mb-6">
                <button
                    onClick={() => setActiveTab('zarr')}
                    className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center ${
                        activeTab === 'zarr'
                            ? 'border-teal-500 text-teal-600 bg-teal-50'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    disabled={isClosing}
                >
                    <CubeIcon className="h-4 w-4 mr-2" />
                    Zarr Store
                </button>
                <button
                    onClick={() => setActiveTab('aida')}
                    className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center ${
                        activeTab === 'aida'
                            ? 'border-teal-500 text-teal-600 bg-teal-50'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    disabled={isClosing}
                >
                    <FolderIcon className="h-4 w-4 mr-2" />
                    AIDA Projects
                </button>
            </div>
            
            {activeTab === 'zarr' && (
                <>
                    <div className="flex gap-4 items-end mb-5">
                        <div className="flex-1 min-w-0">
                            <label className="block mb-2 font-bold text-base text-gray-700">
                                Store URL:
                            </label>
                            <input 
                                type="text" 
                                value={source}
                                onChange={(e) => setSource(e.target.value)}
                                disabled={isClosing}
                                className={`w-full p-3 border-2 border-gray-300 rounded-md text-base outline-none transition-all duration-200 focus:border-teal-500 ${
                                    isClosing ? 'opacity-30' : 'opacity-100'
                                }`}
                                placeholder="Enter Zarr store URL"
                            />
                        </div>
                        
                        <button 
                            onClick={handleLoadStore} 
                            disabled={isLoading || !source || isClosing}
                            className={`px-6 py-3 text-white border-none rounded-md cursor-pointer text-base font-bold flex-shrink-0 whitespace-nowrap transition-all duration-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 flex items-center ${
                                isLoading || !source || isClosing 
                                    ? 'bg-gray-500 cursor-not-allowed' 
                                    : 'bg-teal-600 hover:bg-teal-700'
                            } ${isClosing ? 'opacity-30' : 'opacity-100'}`}
                        >
                            {isLoading ? (
                                <>
                                    <RefreshIcon className="h-5 w-5 mr-2 animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                <>
                                    <PlayIcon className="h-5 w-5 mr-2" />
                                    Load Store
                                </>
                            )}
                        </button>
                    </div>
                </>
            )}

            {activeTab === 'aida' && (
                <div className="text-center">
                    <div className="mb-6 p-4 bg-teal-50 rounded-lg border border-teal-200">
                        <p className="text-teal-800 mb-4">
                            Browse and load DZI, TIFF, and project files from your local AIDA server
                        </p>
                        <button
                            onClick={handleBrowseAIDA}
                            disabled={isClosing}
                            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ExternalLinkIcon className="h-5 w-5 mr-2" />
                            Browse Local Projects
                        </button>
                    </div>
                </div>
            )}

            {/* Success message when store is loaded */}
            {showSuccess && activeTab === 'zarr' && (
                <div className={`mt-4 p-4 bg-green-50 border border-green-200 text-green-800 rounded-md text-base text-center font-bold transition-opacity duration-1000 ease-out ${
                    isClosing ? 'opacity-0' : 'opacity-100'
                }`}>
                    <CheckCircleIcon className="h-5 w-5 inline mr-2" />
                    Store loaded successfully! Opening viewers...
                </div>
            )}

            {/* Loading indicator */}
            {isLoading && !hasLoadedStore && activeTab === 'zarr' && (
                <div className="mt-4 text-center p-4 bg-blue-50 rounded-md text-teal-700 text-sm">
                    <div className="mb-3 flex items-center justify-center">
                        <RefreshIcon className="h-5 w-5 mr-2 animate-spin" />
                        Loading Zarr store...
                    </div>
                    <div className="w-full h-1 bg-blue-200 rounded-full overflow-hidden">
                        <div className="w-1/3 h-full bg-blue-500 rounded-full animate-pulse" />
                    </div>
                </div>
            )}
            
            {(infoMessage || error) && !hasLoadedStore && activeTab === 'zarr' && (
                <div className={`mt-4 p-4 rounded-md text-base text-center ${
                    [ZarrStoreSuggestionType.PLATE_WELL, ZarrStoreSuggestionType.NO_MULTISCALE].includes(suggestionType)
                        ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                        : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                    {suggestionType === ZarrStoreSuggestionType.PLATE_WELL ? (
                        <div className="text-center mb-3 flex items-center justify-center">
                            <TableIcon className="h-5 w-5 mr-2" />
                            <strong>OME-Plate/Well Structure Detected</strong>
                        </div>
                    ) : infoMessage ? (
                        <div className="flex items-center justify-center">
                            <InformationCircleIcon className="h-5 w-5 mr-2" />
                            {infoMessage}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center">
                            <ExclamationIcon className="h-5 w-5 mr-2" />
                            {error}
                        </div>
                    )}
                    
                    {/* Show OME-Zarr specific suggestions */}
                    {renderSuggestions()}
                </div>
            )}

            {!hasLoadedStore && !isLoading && !showSuccess && activeTab === 'zarr' && (
                <div className="mt-5 p-4 bg-gray-50 rounded-md text-sm text-gray-600">
                    <div className="flex items-center">
                        <LightBulbIcon className="h-5 w-5 mr-2 text-gray-400" />
                        <strong>Tip: </strong> You can use the sample OME-Zarr URL above or paste your own store URL
                    </div>
                </div>
            )}
        </div>
        </>
    )
}
