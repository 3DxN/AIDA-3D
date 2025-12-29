'use client';

import React, { useState } from 'react';
import { RefreshIcon, GlobeAltIcon } from '@heroicons/react/solid';
import { useZarrStore } from '../../../../lib/contexts/ZarrStoreContext';

const ServerConnection = () => {
  const { source, loadFromUrlParams, isLoading } = useZarrStore();
  const [url, setUrl] = useState(source || 'http://localhost:5500');

  const handleConnect = async () => {
    if (!url) return;
    console.log(`🔌 Connecting to server: ${url}`);
    // Connect to server root
    await loadFromUrlParams(url, '', '');
  };

  return (
    <div className="px-4 py-3 border-b border-gray-200 bg-teal-50">
      <label className="block text-[10px] font-bold text-teal-700 uppercase tracking-widest mb-2 flex items-center">
        <GlobeAltIcon className="h-3 w-3 mr-1" />
        Data Source
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Server URL (e.g. http://localhost:5500)"
          className="flex-1 min-w-0 bg-white border border-teal-200 text-xs rounded px-2 py-1.5 focus:ring-1 focus:ring-teal-500 focus:outline-none"
        />
        <button
          onClick={handleConnect}
          disabled={isLoading}
          title="Connect/Reload"
          className="p-1.5 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:bg-gray-400 transition-colors"
        >
          <RefreshIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {source && (
          <div className="mt-1.5 text-[10px] text-teal-600 truncate opacity-70">
              Connected: {source}
          </div>
      )}
    </div>
  );
};

export default ServerConnection;
