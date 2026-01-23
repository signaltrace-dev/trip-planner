'use client';

import { useLoadScript, Libraries } from '@react-google-maps/api';
import { ReactNode } from 'react';

const libraries: Libraries = ['places', 'maps'];

interface GoogleMapsProviderProps {
  children: ReactNode;
  apiKey: string;
}

export function GoogleMapsProvider({ children, apiKey }: GoogleMapsProviderProps) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey,
    libraries,
  });

  if (loadError) {
    return (
      <div className="p-4 bg-red-100 text-red-700 rounded-lg">
        Error loading Google Maps. Please check your API key.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading maps...</span>
      </div>
    );
  }

  return <>{children}</>;
}
