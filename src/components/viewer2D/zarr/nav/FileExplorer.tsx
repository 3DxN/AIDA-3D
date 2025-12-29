'use client';

import React, { useState, useEffect } from 'react';
import { FolderIcon, CubeIcon, PlusIcon, HomeIcon } from '@heroicons/react/solid';
import { useZarrStore } from '../../../../lib/contexts/ZarrStoreContext';

const FileExplorer = () => {
  const { fetchDirectoryListing, loadZarrArray, addUserLabelPath, source, setSource, loadFromUrlParams } = useZarrStore();
  const [currentPath, setCurrentPath] = useState('');
  const [folders, setFolders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadListing = async (path: string) => {
    if (!source) return;
    setIsLoading(true);
    const result = await fetchDirectoryListing(path);
    setFolders(result);
    setCurrentPath(path);
    setIsLoading(false);
  };

  useEffect(() => {
    if (source) {
        loadListing('');
    }
  }, [source]);

  const navigateTo = (folder: string) => {
    const newPath = currentPath ? `${currentPath}/${folder}` : folder;
    loadListing(newPath);
  };

  const goHome = () => loadListing('');
  
  const goBack = () => {
    const parts = currentPath.split('/');
    parts.pop();
    loadListing(parts.join('/'));
  };

  const isRemote = source.includes('141.147.64.20');

  return (
    <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 max-h-64 overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
          {isRemote ? '🌐 ONLINE DEMO' : '📍 THIS COMPUTER'}
        </label>
        <button onClick={goHome} className="text-teal-600 hover:text-teal-700 p-1 rounded hover:bg-teal-50" title="Home">
          <HomeIcon className="h-3 w-3" />
        </button>
      </div>

      <div className="text-[10px] text-gray-500 mb-2 truncate bg-white p-1 rounded border border-gray-200 flex items-center group">
        <span className="truncate flex-1">{currentPath || '/'}</span>
        {currentPath && (
          <button onClick={goBack} className="ml-2 text-blue-600 hover:underline font-bold px-1">
            UP
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-[10px] text-gray-400 animate-pulse py-2">Scanning...</div>
      ) : (
        <div className="space-y-1">
          {folders.map((folder) => (
            <div key={folder.name} className="group flex items-center p-1 hover:bg-white rounded border border-transparent hover:border-gray-200 transition-all">
              <button 
                onClick={() => navigateTo(folder.name)}
                className="flex items-center flex-1 text-left min-w-0"
              >
                <FolderIcon className={`h-3 w-3 shrink-0 ${folder.is_zarr ? 'text-teal-400' : 'text-amber-400'} mr-1.5`} />
                <span className={`text-xs truncate ${folder.is_zarr ? 'text-teal-700 font-medium' : 'text-gray-700'}`}>
                    {folder.name}
                </span>
              </button>
              
              <div className="hidden group-hover:flex space-x-1 ml-2 shrink-0">
                {/* 🛡️ ISSUE 0: Only LOAD if NOT in a labels subfolder */}
                {folder.is_zarr && !currentPath.toLowerCase().includes('/labels') && !currentPath.toLowerCase().endsWith('labels') && (
                    <button
                      onClick={() => loadZarrArray(currentPath ? `${currentPath}/${folder.name}` : folder.name)}
                      className="flex items-center px-1.5 py-0.5 bg-teal-600 text-white rounded hover:bg-teal-700 text-[9px] font-bold shadow-sm"
                    >
                      <CubeIcon className="h-2.5 w-2.5 mr-1" />
                      LOAD IMAGE
                    </button>
                )}
                {/* Show ADD button for anything in or identified as labels */}
                {(folder.is_labels || currentPath.toLowerCase().includes('labels')) && (
                    <button
                      onClick={() => {
                        // 🛡️ FIX: Only add the relative labels path, not the full path
                        let fullPath = currentPath ? `${currentPath}/${folder.name}` : folder.name;
                        // Extract just the labels/xxx part to prevent path doubling
                        const labelsMatch = fullPath.match(/(labels\/.*)/i);
                        const pathToAdd = labelsMatch ? labelsMatch[1] : fullPath;
                        addUserLabelPath(pathToAdd);
                      }}
                      className="flex items-center px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-[9px] font-bold shadow-sm"
                    >
                      <PlusIcon className="h-2.5 w-2.5 mr-1" />
                      ADD LABELS
                    </button>
                )}
              </div>
            </div>
          ))}
          {folders.length === 0 && <div className="text-[10px] text-gray-400 italic py-2">No folders found</div>}
        </div>
      )}

      <div className="mt-4 pt-2 border-t border-gray-200">
          {isRemote ? (
              <button
                onClick={() => {
                    setSource("http://127.0.0.1:5500");
                    loadFromUrlParams("http://127.0.0.1:5500", "newtask/FLAIR_v05.zarr", "labels/Anatomy");
                }}
                className="w-full py-1.5 bg-teal-50 text-teal-600 rounded border border-teal-100 text-[9px] font-bold hover:bg-indigo-100 transition-colors flex items-center justify-center shadow-sm"
              >
                  🏠 SWITCH TO MY COMPUTER
              </button>
          ) : (
              <button
                onClick={() => {
                    setSource("http://141.147.64.20:5500");
                    loadFromUrlParams("http://141.147.64.20:5500", "0", "labels/Cellpose");
                }}
                className="w-full py-1.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100 text-[9px] font-bold hover:bg-indigo-100 transition-colors flex items-center justify-center shadow-sm"
              >
                  🌐 SWITCH TO ONLINE DEMO
              </button>
          )}
      </div>
    </div>
  );
};

export default FileExplorer;